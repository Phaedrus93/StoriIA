import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAndExpireGiftSubscription } from "@/lib/billing-utils";
import {
  isDailyRateLimitExceeded,
  generateStoryWithGemini,
  type AgeRange,
} from "@/lib/ai/story-generator";
import { notifyFamily } from "@/lib/notifications";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // 1. Verifica utente autenticato e non in modalità bambino
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    if (user.app_metadata?.is_child_mode) {
      return NextResponse.json(
        { error: "La generazione storie è riservata al genitore." },
        { status: 403 }
      );
    }

    // 2. Ottieni la famiglia del genitore
    let { data: family, error: famErr } = await supabase
      .from("families")
      .select("id, subscription_status, credits_balance, gift_subscription_expires_at, pre_gift_tier")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json(
        { error: "Famiglia non trovata per questo account." },
        { status: 404 }
      );
    }

    const adminClient = createAdminClient();
    const { expired } = await checkAndExpireGiftSubscription(adminClient, family.id, family);
    if (expired) {
      const { data: updatedFam } = await supabase
        .from("families")
        .select("id, subscription_status, credits_balance, gift_subscription_expires_at, pre_gift_tier")
        .eq("id", family.id)
        .single();
      if (updatedFam) family = updatedFam;
    }

    // Verifica abbonamento non sospeso (frozen per mancato pagamento)
    if (family.subscription_status === "frozen") {
      return NextResponse.json(
        {
          error:
            "Generazione temporaneamente bloccata: abbonamento sospeso per pagamento fallito. Verifica la tua posizione di fatturazione.",
          subscriptionFrozen: true,
        },
        { status: 403 }
      );
    }

    // Verifica saldo crediti sufficiente
    if ((family.credits_balance || 0) <= 0) {
      return NextResponse.json(
        {
          error:
            "Hai esaurito i crediti disponibili per generare storie. Ricarica i crediti o effettua l'upgrade del piano!",
          outOfCredits: true,
        },
        { status: 402 }
      );
    }

    const body = await req.json();
    const {
      ageRange,
      characterId,
      characterName,
      characterTraits,
      settingId,
      settingName,
      settingDescription,
      moralLessonTitle,
      moralLessonDescription,
      assignToChildIds,
      preciseAge,
      precise_age,
    } = body;

    const resolvedPreciseAge = typeof preciseAge === "number" ? preciseAge : typeof precise_age === "number" ? precise_age : undefined;

    // Controllo limiti di lunghezza sui campi verso il prompt AI
    if (characterName && characterName.length > 50) {
      return NextResponse.json({ error: "Il nome del personaggio supera il limite massimo di 50 caratteri." }, { status: 400 });
    }
    if (characterTraits && characterTraits.length > 300) {
      return NextResponse.json({ error: "I tratti del personaggio superano il limite massimo di 300 caratteri." }, { status: 400 });
    }
    if (settingName && settingName.length > 50) {
      return NextResponse.json({ error: "Il nome dell'ambientazione supera il limite massimo di 50 caratteri." }, { status: 400 });
    }
    if (settingDescription && settingDescription.length > 300) {
      return NextResponse.json({ error: "La descrizione dell'ambientazione supera il limite massimo di 300 caratteri." }, { status: 400 });
    }
    if (moralLessonTitle && moralLessonTitle.length > 50) {
      return NextResponse.json({ error: "Il titolo dell'insegnamento supera il limite massimo di 50 caratteri." }, { status: 400 });
    }
    if (moralLessonDescription && moralLessonDescription.length > 300) {
      return NextResponse.json({ error: "La descrizione dell'insegnamento supera il limite massimo di 300 caratteri." }, { status: 400 });
    }

    // 3. Controllo Soft Rate Limit (max 20 storie al giorno per famiglia)
    const today = new Date().toISOString().split("T")[0];
    const { count } = await supabase
      .from("stories")
      .select("*", { count: "exact", head: true })
      .eq("family_id", family.id)
      .gte("created_at", `${today}T00:00:00.000Z`);

    if (isDailyRateLimitExceeded(count || 0)) {
      return NextResponse.json(
        {
          error:
            "Hai raggiunto il limite giornaliero di 20 storie per la tua famiglia. Riprova domani!",
          rateLimitExceeded: true,
        },
        { status: 429 }
      );
    }

    // 4. Registrazione Audit Log in stato STARTED
    let auditLogId: string | null = null;
    let creditDeducted = false;
    const { data: auditLog } = await supabase
      .from("generation_audit_logs")
      .insert({
        family_id: family.id,
        child_profile_id:
          Array.isArray(assignToChildIds) && assignToChildIds.length > 0
            ? assignToChildIds[0]
            : null,
        status: "STARTED",
        prompt_summary: `Fascia: ${ageRange || "4-6"}, Protagonista: ${characterName || "Protagonista"}, Luogo: ${settingName || "Mondo Magico"}${resolvedPreciseAge !== undefined ? `, Età precisa: ${resolvedPreciseAge}` : ""}`,
      })
      .select("id")
      .single();

    if (auditLog?.id) {
      auditLogId = auditLog.id;
    }

    // Scalaggio atomico 1 credito e registrazione su credit_ledger
    const { data: consumed } = await supabase.rpc("consume_credit", {
      p_family_id: family.id,
      p_description: "Generazione storia AI",
      p_reference_id: auditLogId || null,
    });
    if (consumed !== true) {
      return NextResponse.json(
        { error: "Crediti insufficienti o errore transazione." },
        { status: 403 }
      );
    }
    creditDeducted = true;

    // 5. Generazione del testo AI con moderazione
    const generatedText = await generateStoryWithGemini({
      ageRange: (ageRange || "4-6") as AgeRange,
      characterName: characterName || "Protagonista",
      characterTraits: characterTraits || "Coraggioso e gentile",
      settingName: settingName || "Mondo Magico",
      settingDescription: settingDescription || "Un luogo fantastico",
      moralLessonTitle: moralLessonTitle || "Amicizia",
      moralLessonDescription:
        moralLessonDescription || "L'importanza di collaborare",
      preciseAge: resolvedPreciseAge,
    });

    // 6. Salvataggio della storia nella tabella stories
    const { data: newStory, error: insertStoryErr } = await supabase
      .from("stories")
      .insert({
        family_id: family.id,
        character_id: characterId || null,
        setting_id: settingId || null,
        target_age_range: ageRange || "4-6",
        generated_text: generatedText,
      })
      .select("*")
      .single();

    if (insertStoryErr || !newStory) {
      if (auditLogId) {
        await supabase
          .from("generation_audit_logs")
          .update({
            status: "ERROR",
            error_reason: "Errore inserimento DB stories",
            completed_at: new Date().toISOString(),
          })
          .eq("id", auditLogId);
      }
      if (creditDeducted) {
        await supabase.rpc("refund_credit", {
          p_family_id: family.id,
          p_description: "Rimborso automatico per errore salvataggio storia",
          p_reference_id: auditLogId || null,
        });
      }
      await notifyFamily({
        familyId: family.id,
        category: "activity",
        title: "Errore salvataggio storia ⚠️",
        message: "Si è verificato un errore durante il salvataggio della storia. Il credito è stato rimborsato.",
      });
      return NextResponse.json(
        { error: "Errore durante il salvataggio della storia nel database." },
        { status: 500 }
      );
    }

    // 7. Aggiornamento Audit Log ad esito SUCCESS
    if (auditLogId) {
      await supabase
        .from("generation_audit_logs")
        .update({
          status: "SUCCESS",
          completed_at: new Date().toISOString(),
        })
        .eq("id", auditLogId);
    }

    // 8. Assegnazione facoltativa alle storie dei profili figli specificati (esclusi i profili sospesi)
    if (Array.isArray(assignToChildIds) && assignToChildIds.length > 0) {
      const { data: activeChildProfiles } = await supabase
        .from("child_profiles")
        .select("id")
        .in("id", assignToChildIds)
        .eq("family_id", family.id)
        .eq("is_suspended", false);

      const validChildIds = (activeChildProfiles || []).map((c) => c.id);

      if (validChildIds.length > 0) {
        const assignments = validChildIds.map((childId: string) => ({
          story_id: newStory.id,
          child_profile_id: childId,
          reading_status: "new",
          last_read_position: 0,
        }));

        await supabase.from("story_assignments").insert(assignments);
      }
    }

    await notifyFamily({
      familyId: family.id,
      category: "activity",
      title: "Nuova storia generata! ✨",
      message: `La storia "${newStory.title || characterName || "Avventura Magica"}" è pronta da leggere e ascoltare nella libreria.`,
      actionLink: `/stories`,
    });

    return NextResponse.json({
      success: true,
      story: newStory,
      auditLogId,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Errore imprevisto server";

    const isModBlock = message.includes("MODERATION_BLOCKED");
    // Rimborso credito e log audit errore in caso di fallimento o blocco moderazione
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: family } = await supabase
          .from("families")
          .select("id, credits_balance")
          .eq("parent_user_id", user.id)
          .single();
        if (family) {
          // Rimborso atomico +1 credito sul saldo e registrazione su ledger
          await supabase.rpc("refund_credit", {
            p_family_id: family.id,
            p_description: `Rimborso automatico per ${isModBlock ? "blocco moderazione" : "errore generazione"}`,
          });

          await supabase.from("generation_audit_logs").insert({
            family_id: family.id,
            status: isModBlock ? "MODERATION_BLOCKED" : "ERROR",
            error_reason: message,
            completed_at: new Date().toISOString(),
          });

          await notifyFamily({
            familyId: family.id,
            category: "activity",
            title: isModBlock ? "Generazione bloccata dai filtri 🛡️" : "Errore generazione storia ⚠️",
            message: isModBlock
              ? "Il contenuto richiesto non ha superato i filtri di sicurezza per bambini. Il credito è stato rimborsato automaticamente."
              : "Si è verificato un problema tecnico durante la generazione della storia. Il credito AI è stato rimborsato.",
          });
        }
      }
    } catch {
      // Ignora errori secondari di rimborso nel blocco catch
    }

    return NextResponse.json(
      { error: message, moderationBlocked: isModBlock },
      { status: isModBlock ? 400 : 500 }
    );
  }
}
