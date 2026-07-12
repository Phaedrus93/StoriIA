import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE() {
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
        { error: "La cancellazione account è riservata al genitore." },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();

    // 1. Eliminazione esplicita della famiglia (a cascata elimina child_profiles, stories, characters, settings, audit_logs)
    const { error: famDelErr } = await adminClient
      .from("families")
      .delete()
      .eq("parent_user_id", user.id);

    if (famDelErr) {
      return NextResponse.json(
        { error: `Errore cancellazione dati famiglia: ${famDelErr.message}` },
        { status: 500 }
      );
    }

    // 2. Eliminazione definitiva dell'utente auth da Supabase
    const { error: authDelErr } = await adminClient.auth.admin.deleteUser(user.id);

    if (authDelErr) {
      return NextResponse.json(
        { error: `Errore cancellazione account utente: ${authDelErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedUserId: user.id,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Errore durante cancellazione account GDPR";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
