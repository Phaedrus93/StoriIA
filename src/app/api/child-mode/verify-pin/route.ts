import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyParentPin } from "@/lib/security/pin";

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
    const { pin } = body;

    if (!pin || typeof pin !== "string") {
      return NextResponse.json(
        { error: "PIN numerico richiesto" },
        { status: 400 }
      );
    }

    // Identifica la famiglia dell'utente
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

    // Consulta lo stato di sicurezza tramite la funzione SECURITY DEFINER
    const { data: statusRows, error: rpcErr } = await supabase.rpc(
      "get_lockout_status",
      {
        p_family_id: family.id,
      }
    );

    if (rpcErr || !statusRows || statusRows.length === 0) {
      return NextResponse.json(
        { error: "PIN genitore non ancora configurato per questa famiglia." },
        { status: 400 }
      );
    }

    const secStatus = statusRows[0];

    // 1. Controllo Lockout anti brute-force
    if (secStatus.is_locked) {
      return NextResponse.json(
        {
          error:
            "Troppi tentativi errati. Accesso temporaneamente bloccato per 15 minuti per motivi di sicurezza.",
          lockout: true,
          lockedUntil: secStatus.locked_until,
        },
        { status: 429 }
      );
    }

    // 2. Verifica hash scrypt
    const pinHash = secStatus.pin_hash;
    if (!pinHash) {
      return NextResponse.json(
        { error: "PIN genitore non configurato." },
        { status: 400 }
      );
    }

    const isMatch = await verifyParentPin(pin, pinHash);

    // 3. Registra esito tentativo nel database (incrementa fallimenti o resetta a 0 se successo)
    await supabase.rpc("record_pin_attempt", {
      p_family_id: family.id,
      p_success: isMatch,
    });

    if (!isMatch) {
      const newFailedCount = (secStatus.failed_attempts || 0) + 1;
      if (newFailedCount >= 5) {
        return NextResponse.json(
          {
            error:
              "PIN errato per la 5a volta. Sistema bloccato per 15 minuti.",
            lockout: true,
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          error: `PIN errato. Ti restano ${
            5 - newFailedCount
          } tentativi prima del blocco temporaneo.`,
          success: false,
        },
        { status: 401 }
      );
    }

    // 4. Se successo: disattiva modalità bambino ed elimina active_child_profile_id
    await supabase.auth.updateUser({
      data: {
        is_child_mode: false,
        active_child_profile_id: null,
      },
    });

    const response = NextResponse.json({
      success: true,
      message: "PIN corretto. Uscita dalla modalità bambino completata.",
      requireClientRefresh: true,
    });
    response.cookies.delete("storiia_child_mode");
    return response;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Errore imprevisto server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
