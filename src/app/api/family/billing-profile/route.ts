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

    if (user.app_metadata?.is_child_mode) {
      return NextResponse.json(
        { error: "Accesso riservato al genitore." },
        { status: 403 }
      );
    }

    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json(
        { error: "Famiglia non trovata" },
        { status: 404 }
      );
    }

    const { data: billingProfile } = await supabase
      .from("parent_billing_profiles")
      .select("*")
      .eq("family_id", family.id)
      .maybeSingle();

    return NextResponse.json({
      billingProfile: billingProfile || {
        first_name: "",
        last_name: "",
        tax_id: "",
        billing_address: "",
        city: "",
        postal_code: "",
        country: "IT",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Errore lettura profilo fatturazione";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
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
        { error: "La modifica fatturazione è riservata al genitore." },
        { status: 403 }
      );
    }

    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json(
        { error: "Famiglia non trovata" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      first_name,
      last_name,
      tax_id,
      billing_address,
      city,
      postal_code,
      country,
    } = body;

    if (!first_name || !last_name) {
      return NextResponse.json(
        { error: "Nome e cognome sono obbligatori per la fatturazione." },
        { status: 400 }
      );
    }

    const { data: updated, error: upsertErr } = await supabase
      .from("parent_billing_profiles")
      .upsert(
        {
          family_id: family.id,
          first_name,
          last_name,
          tax_id: tax_id || "",
          billing_address: billing_address || "",
          city: city || "",
          postal_code: postal_code || "",
          country: country || "IT",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "family_id" }
      )
      .select("*")
      .single();

    if (upsertErr) {
      return NextResponse.json(
        { error: `Errore salvataggio fatturazione: ${upsertErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      billingProfile: updated,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Errore aggiornamento profilo fatturazione";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
