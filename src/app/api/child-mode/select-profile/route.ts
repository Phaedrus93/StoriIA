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

    // Verifica che il genitore abbia configurato il PIN di sicurezza prima di attivare la modalità bambino
    const { data: statusRows } = await supabase.rpc("get_lockout_status", {
      p_family_id: family.id,
    });
    const secRow = statusRows && statusRows.length > 0 ? statusRows[0] : null;

    if (!secRow || !secRow.pin_hash) {
      return NextResponse.json(
        {
          error:
            "PIN genitore non ancora configurato. Impostalo prima di entrare in Modalità Bambino.",
        },
        { status: 403 }
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

    // Aggiorna app_metadata utente affinché il JWT contenga is_child_mode=true e active_child_profile_id=childProfileId
    const adminSupabase = createAdminClient();
    await adminSupabase.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...(user.app_metadata || {}),
        is_child_mode: true,
        active_child_profile_id: childProfileId,
      },
    });

    const response = NextResponse.json({
      success: true,
      message: "Profilo bambino selezionato con successo",
      childProfileId,
      childProfileName: childProfile.name,
      requireClientRefresh: true,
    });

    response.cookies.set("storiia_child_mode", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    return response;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Errore imprevisto server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
