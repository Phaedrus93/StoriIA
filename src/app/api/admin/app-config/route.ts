import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAdminPrivileges, createAdminClient } from "@/lib/admin";

export const VALID_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

export async function GET() {
  try {
    const supabase = await createClient();
    const { isAdmin, error } = await checkAdminPrivileges(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: error || "Non autorizzato" }, { status: 403 });
    }

    const { data, error: dbErr } = await supabase
      .from("app_config_parameters")
      .select("*")
      .order("key", { ascending: true });

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ app_config: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore recupero configurazione app";
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
    const items = Array.isArray(body.app_config) ? body.app_config : Array.isArray(body) ? body : [body];

    const adminClient = createAdminClient();
    const results = [];

    for (const item of items) {
      if (!item.key || item.value === undefined) continue;

      // Validazione specifica per modelli Gemini
      if (item.key === "ai_default_model" || item.key === "ai_fallback_model") {
        let modelName = item.value;
        if (typeof modelName === "string" && modelName.startsWith('"') && modelName.endsWith('"')) {
          modelName = JSON.parse(modelName);
        }
        if (!VALID_GEMINI_MODELS.includes(modelName)) {
          return NextResponse.json(
            { error: `Modello Gemini non valido per ${item.key}: '${modelName}'. I modelli consentiti sono: ${VALID_GEMINI_MODELS.join(", ")}` },
            { status: 400 }
          );
        }
      }

      // Assicura che il value sia un json specificato correttamente o primitivo serializzato
      const jsonValue = typeof item.value === "string" && (item.value.startsWith("{") || item.value.startsWith("[") || item.value.startsWith('"'))
        ? JSON.parse(item.value)
        : item.value;

      const { data, error: dbErr } = await adminClient
        .from("app_config_parameters")
        .upsert({
          key: item.key,
          value: jsonValue,
          description: item.description || "",
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" })
        .select()
        .single();

      if (dbErr) {
        return NextResponse.json({ error: `Errore aggiornamento parametro ${item.key}: ${dbErr.message}` }, { status: 500 });
      }
      results.push(data);
    }

    return NextResponse.json({ success: true, updated: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore aggiornamento configurazione app";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
