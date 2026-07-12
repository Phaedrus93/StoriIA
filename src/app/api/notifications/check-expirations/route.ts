import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyFamily } from "@/lib/notifications";

/**
 * POST /api/notifications/check-expirations
 * Endpoint che verifica e invia notifiche preventive per:
 * 1. Crediti AI in esaurimento (< 5 crediti)
 * 2. Stato abbonamento in scadenza o frozen
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { data: family } = await supabase
      .from("families")
      .select("id, subscription_tier, subscription_status, credits_balance")
      .eq("parent_user_id", user.id)
      .single();

    if (!family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    const results: string[] = [];

    // 1. Verifica crediti bassi (< 5)
    const balance = family.credits_balance || 0;
    if (balance > 0 && balance < 5) {
      // Controlla se abbiamo già notificato un avviso crediti bassi di recente (ultime 24h)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentCreditsNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("family_id", family.id)
        .eq("category", "credits")
        .gte("created_at", yesterday)
        .limit(1);

      if (!recentCreditsNotif || recentCreditsNotif.length === 0) {
        await notifyFamily({
          familyId: family.id,
          category: "credits",
          title: "Crediti AI in esaurimento ⚡",
          message: `Ti restano solo ${balance} crediti AI per generare nuove favole. Ricarica ora per non interrompere la magia.`,
          actionLink: "/billing",
          sendEmail: true,
        });
        results.push(`Avviso crediti bassi inviato (saldo: ${balance})`);
      }
    }

    // 2. Verifica stato abbonamento Frozen o Richiesta Attenzione
    if (family.subscription_status === "frozen") {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentFrozenNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("family_id", family.id)
        .eq("category", "billing")
        .gte("created_at", yesterday)
        .limit(1);

      if (!recentFrozenNotif || recentFrozenNotif.length === 0) {
        await notifyFamily({
          familyId: family.id,
          category: "billing",
          title: "Abbonamento Sospeso (Azione Richiesta) ⚠️",
          message: "L'ultimo pagamento dell'abbonamento non è andato a buon fine. Aggiorna il metodo di pagamento per sbloccare la generazione delle storie.",
          actionLink: "/billing",
          sendEmail: true,
        });
        results.push("Avviso abbonamento frozen inviato");
      }
    }

    return NextResponse.json({
      success: true,
      checksPerformed: results,
    });
  } catch (err) {
    return NextResponse.json({ error: "Errore interno server" }, { status: 500 });
  }
}
