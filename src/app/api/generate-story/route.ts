import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isDailyRateLimitExceeded,
  generateStoryWithGemini,
  type AgeRange,
} from "@/lib/ai/story-generator";

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
    // 2. Ottieni la famiglia del genitore
    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("id, subscription_status, credits_balance")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json(
        { error: "Famiglia non trovata per questo account." },
        { status: 404 }
      );
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
    } = body;

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
        prompt_summary: `Fascia: ${ageRange || "4-6"}, Protagonista: ${characterName || "Protagonista"}, Luogo: ${settingName || "Mondo Magico"}`,
      })
      .select("id")
      .single();

    if (auditLog?.id) {
      auditLogId = auditLog.id;
    }

    // Scalaggio atomico 1 credito e registrazione su credit_ledger
    await supabase
      .from("families")
      .update({ credits_balance: (family.credits_balance || 0) - 1 })
      .eq("id", family.id);

    await supabase.from("credit_ledger").insert({
      family_id: family.id,
      amount: -1,
      transaction_type: "GENERATION_SPEND",
      description: "Generazione storia AI",
      reference_id: auditLogId || null,
    });
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
        await supabase
          .from("families")
          .update({ credits_balance: family.credits_balance })
          .eq("id", family.id);

        await supabase.from("credit_ledger").insert({
          family_id: family.id,
          amount: 1,
          transaction_type: "GENERATION_REFUND",
          description: "Rimborso automatico per errore salvataggio storia",
          reference_id: auditLogId || null,
        });
      }
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

    // 8. Assegnazione facoltativa alle storie dei profili figli specificati
    if (Array.isArray(assignToChildIds) && assignToChildIds.length > 0) {
      const assignments = assignToChildIds.map((childId: string) => ({
        story_id: newStory.id,
        child_profile_id: childId,
        reading_status: "new",
        last_read_position: 0,
      }));

      await supabase.from("story_assignments").insert(assignments);
    }

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
          // Rimborso +1 credito sul saldo
          await supabase
            .from("families")
            .update({ credits_balance: (family.credits_balance || 0) + 1 })
            .eq("id", family.id);

          await supabase.from("credit_ledger").insert({
            family_id: family.id,
            amount: 1,
            transaction_type: "GENERATION_REFUND",
            description: `Rimborso automatico per ${isModBlock ? "blocco moderazione" : "errore generazione"}`,
          });

          await supabase.from("generation_audit_logs").insert({
            family_id: family.id,
            status: isModBlock ? "MODERATION_BLOCKED" : "ERROR",
            error_reason: message,
            completed_at: new Date().toISOString(),
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
