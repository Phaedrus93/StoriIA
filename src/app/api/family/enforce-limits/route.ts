import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceSuspensionOnDowngrade } from "@/lib/billing-utils";
import { SubscriptionTier } from "@/lib/config";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    if (user.app_metadata?.is_child_mode) {
      return NextResponse.json(
        { error: "Azione riservata al genitore." },
        { status: 403 }
      );
    }

    const { keepChildIds } = await req.json();
    if (!keepChildIds || !Array.isArray(keepChildIds) || keepChildIds.length === 0) {
      return NextResponse.json(
        { error: "Devi selezionare almeno un profilo da mantenere attivo." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { data: family, error: famErr } = await adminClient
      .from("families")
      .select("id, subscription_tier")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    const res = await enforceSuspensionOnDowngrade(
      adminClient,
      family.id,
      family.subscription_tier as SubscriptionTier,
      { keepChildIds }
    );

    return NextResponse.json({ success: true, suspendedCount: res.suspendedCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore durante la conferma della scelta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
