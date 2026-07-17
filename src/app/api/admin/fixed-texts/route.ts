import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAdminPrivileges, createAdminClient } from "@/lib/admin";

export async function GET() {
  try {
    const supabase = await createClient();
    const { isAdmin, error } = await checkAdminPrivileges(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: error || "Non autorizzato" }, { status: 403 });
    }

    const { data, error: dbErr } = await supabase
      .from("fixed_texts")
      .select("*")
      .order("key", { ascending: true });

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ fixed_texts: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore recupero testi fissi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { isAdmin, error } = await checkAdminPrivileges(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: error || "Non autorizzato" }, { status: 403 });
    }

    const body = await req.json();
    const items = Array.isArray(body.fixed_texts) ? body.fixed_texts : Array.isArray(body) ? body : [body];

    const adminClient = createAdminClient();
    const results = [];

    for (const item of items) {
      if (!item.key || item.content === undefined) continue;

      const { data, error: dbErr } = await adminClient
        .from("fixed_texts")
        .upsert({
          key: item.key,
          content: item.content,
          description: item.description || "",
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" })
        .select()
        .single();

      if (dbErr) {
        return NextResponse.json({ error: `Errore aggiornamento testo ${item.key}: ${dbErr.message}` }, { status: 500 });
      }
      results.push(data);
    }

    return NextResponse.json({ success: true, updated: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore aggiornamento testi fissi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
