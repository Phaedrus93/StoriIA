import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    if (user.app_metadata?.is_child_mode) {
      return NextResponse.json({ error: "Operazione riservata al genitore." }, { status: 403 });
    }

    const body = await req.json();
    const { name, birth_year, avatar_preset_id, gender } = body;
    const childGender = gender && ["neutral", "boy", "girl"].includes(gender) ? gender : "neutral";

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Il nome del bambino è obbligatorio." }, { status: 400 });
    }

    if (!birth_year || typeof birth_year !== "number" || isNaN(birth_year) || birth_year < 2000 || birth_year > 2100) {
      return NextResponse.json({ error: "L'anno di nascita è obbligatorio e deve essere un anno valido." }, { status: 400 });
    }

    const { data: family } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    let familyId = family?.id;
    if (!familyId) {
      const adminClient = createAdminClient();
      const { data: newFam, error: insFamErr } = await adminClient
        .from("families")
        .insert({ parent_user_id: user.id })
        .select("id")
        .single();
      if (insFamErr || !newFam) {
        return NextResponse.json({ error: "Errore durante la creazione della famiglia." }, { status: 500 });
      }
      familyId = newFam.id;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("child_profiles")
      .insert({
        family_id: familyId,
        name: name.trim(),
        birth_year: birth_year,
        gender: childGender,
        avatar_preset_id: avatar_preset_id || null,
      })
      .select("*")
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, child: inserted }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore durante la creazione del profilo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    if (user.app_metadata?.is_child_mode) {
      return NextResponse.json({ error: "Operazione riservata al genitore." }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, birth_year, avatar_preset_id, gender } = body;
    const childGender = gender && ["neutral", "boy", "girl"].includes(gender) ? gender : undefined;

    if (!id) {
      return NextResponse.json({ error: "ID profilo mancante." }, { status: 400 });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Il nome del bambino è obbligatorio." }, { status: 400 });
    }

    if (!birth_year || typeof birth_year !== "number" || isNaN(birth_year) || birth_year < 2000 || birth_year > 2100) {
      return NextResponse.json({ error: "L'anno di nascita è obbligatorio e deve essere un anno valido." }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      name: name.trim(),
      birth_year: birth_year,
      avatar_preset_id: avatar_preset_id || null,
    };
    if (childGender !== undefined) {
      updatePayload.gender = childGender;
    }

    const { data: updated, error: updErr } = await supabase
      .from("child_profiles")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, child: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore durante la modifica del profilo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
