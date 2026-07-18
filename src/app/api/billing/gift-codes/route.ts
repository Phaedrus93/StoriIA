import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    const { data: codes, error: codesErr } = await supabase
      .from("gift_codes")
      .select("*")
      .or(`purchased_by_family_id.eq.${family.id},redeemed_by_family_id.eq.${family.id}`)
      .order("created_at", { ascending: false });

    if (codesErr) {
      return NextResponse.json({ error: codesErr.message }, { status: 500 });
    }

    const purchasedCodes = (codes || []).filter((c) => c.purchased_by_family_id === family.id);
    const redeemedCodes = (codes || []).filter((c) => c.redeemed_by_family_id === family.id && c.purchased_by_family_id !== family.id);

    return NextResponse.json({
      purchasedCodes,
      redeemedCodes,
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore lettura codici regalo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
