import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("id, subscription_tier, subscription_status")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    if (family.subscription_tier === "free") {
      return NextResponse.json(
        { error: "Nessun abbonamento a pagamento attivo da annullare" },
        { status: 400 }
      );
    }

    // Imposta lo stato di cancellazione a fine periodo (non immediato)
    const { error: updateErr } = await supabase
      .from("families")
      .update({
        subscription_status: "canceling_at_period_end",
      })
      .eq("id", family.id);

    if (updateErr) {
      return NextResponse.json(
        { error: "Impossibile aggiornare lo stato di abbonamento" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "L'abbonamento non sarà rinnovato alla scadenza e resterà attivo fino a fine periodo.",
      status: "canceling_at_period_end",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore interno al server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
