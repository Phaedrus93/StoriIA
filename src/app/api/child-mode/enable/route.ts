import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    // Verifica che il profilo bambino appartenga alla famiglia dell'utente
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

    // Aggiorna app_metadata utente affinché il JWT contenga is_child_mode=true e active_child_profile_id
    const adminSupabase = createAdminClient();
    await adminSupabase.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...(user.app_metadata || {}),
        is_child_mode: true,
        active_child_profile_id: childProfileId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Modalità bambino attivata con successo",
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
