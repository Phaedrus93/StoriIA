import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkAdminPrivileges } from "@/lib/admin";

function generateRandomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "GIFT-";
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  code += "-";
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  code += "-";
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { isAdmin, error: adminErr } = await checkAdminPrivileges(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: adminErr || "Accesso negato" }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const { data: codes, error } = await adminClient
      .from("gift_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ codes });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Errore lettura gift codes";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { isAdmin, error: adminErr } = await checkAdminPrivileges(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: adminErr || "Accesso negato" }, { status: 403 });
    }

    const body = await req.json();
    const { type, amount_or_tier, duration_months, notes } = body;

    if (!["subscription", "credits"].includes(type)) {
      return NextResponse.json({ error: "Tipo gift code non valido" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // L'Admin deve avere una famiglia per bypassare il vincolo NOT NULL su purchased_by_family_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const { data: adminFamily } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();
    
    if (!adminFamily) {
      return NextResponse.json({ error: "L'Admin deve prima completare la registrazione del profilo Famiglia." }, { status: 400 });
    }

    let code = generateRandomCode();
    let isUnique = false;
    let attempts = 0;

    // Assicura l'unicità del codice
    while (!isUnique && attempts < 5) {
      const { data: existing } = await adminClient.from("gift_codes").select("id").eq("code", code).single();
      if (!existing) {
        isUnique = true;
      } else {
        code = generateRandomCode();
        attempts++;
      }
    }

    const { data: inserted, error } = await adminClient.from("gift_codes").insert({
      code,
      type,
      amount_or_tier,
      duration_months: duration_months || null,
      status: "active",
      purchased_by_family_id: adminFamily.id,
      notes: notes || "Creato manualmente dall'Admin",
      stripe_session_id: "manual",
    }).select().single();

    if (error) throw error;

    return NextResponse.json({ giftCode: inserted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Errore generazione gift code";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
