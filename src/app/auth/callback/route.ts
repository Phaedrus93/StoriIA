import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Garanzia e idempotenza Account Linking: upsert con ignoreDuplicates per evitare di
        // sovrascrivere o duplicare la famiglia se l'utente esisteva già con email classica.
        const { error: upsertErr } = await supabase
          .from("families")
          .upsert(
            { parent_user_id: user.id },
            { onConflict: "parent_user_id", ignoreDuplicates: true }
          );

        if (upsertErr && !upsertErr.message.includes("duplicate")) {
          console.error("Errore upsert famiglia in callback:", upsertErr.message);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // In caso di errore di scambio o mancanza di code, rimandiamo al login con errore visibile
  return NextResponse.redirect(`${origin}/login?error=recupero-fallito`);
}
