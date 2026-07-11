import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await req.json();
    const { childProfileId } = body;

    if (!childProfileId) {
      return NextResponse.json(
        { error: "ID profilo bambino richiesto" },
        { status: 400 }
      );
    }

    // Verifica che la famiglia appartenga all'utente
    const { data: family } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (!family) {
      return NextResponse.json(
        { error: "Famiglia non trovata" },
        { status: 404 }
      );
    }

    // Verifica che il profilo bambino appartenga specificamente alla famiglia dell'utente loggato
    const { data: childProfile } = await supabase
      .from("child_profiles")
      .select("id, name")
      .eq("id", childProfileId)
      .eq("family_id", family.id)
      .single();

    if (!childProfile) {
      return NextResponse.json(
        { error: "Profilo bambino non appartiene alla tua famiglia" },
        { status: 403 }
      );
    }

    // Aggiorna metadata utente affinché il JWT contenga is_child_mode=true e active_child_profile_id=childProfileId
    await supabase.auth.updateUser({
      data: {
        is_child_mode: true,
        active_child_profile_id: childProfileId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profilo bambino selezionato con successo",
      childProfileId,
      childProfileName: childProfile.name,
      requireClientRefresh: true,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Errore imprevisto server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
