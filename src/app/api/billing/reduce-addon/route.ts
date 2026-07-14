import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/billing/reduce-addon
 * Consente di pianificare la riduzione del numero di add-on profili bambino per la famiglia.
 * La modifica (pending_addon_children_count) prenderà effetto effettivo solo al prossimo
 * ciclo di fatturazione (rinnovo abbonamento).
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    if (user.app_metadata?.is_child_mode) {
      return NextResponse.json(
        { error: "Operazione riservata al genitore." },
        { status: 403 }
      );
    }

    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("id, addon_children_count, pending_addon_children_count")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    const body = await req.json();
    const { targetAddonCount } = body;

    if (typeof targetAddonCount !== "number" || targetAddonCount < 0) {
      return NextResponse.json(
        { error: "Valore target add-on non valido (deve essere intero >= 0)." },
        { status: 400 }
      );
    }

    const currentAddons = family.addon_children_count || 0;

    if (targetAddonCount >= currentAddons) {
      return NextResponse.json(
        { error: "La riduzione add-on richiede un numero di add-on inferiore all'attuale." },
        { status: 400 }
      );
    }

    // Salviamo il valore pianificato in pending_addon_children_count
    const { error: updErr } = await supabase
      .from("families")
      .update({
        pending_addon_children_count: targetAddonCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", family.id);

    if (updErr) {
      return NextResponse.json(
        { error: "Errore durante il salvataggio della riduzione add-on." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Riduzione pianificata: avrai ${targetAddonCount} add-on a partire dal prossimo rinnovo.`,
      pendingAddonCount: targetAddonCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore pianificazione riduzione add-on";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
