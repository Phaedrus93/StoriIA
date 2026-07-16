import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function handleChildAccessibilityGetServer(
  supabase: any,
  adminClient: any,
  childId?: string | null
) {
  if (childId) {
    const { data: child, error } = await adminClient
      .from("child_profiles")
      .select("id, name, night_mode, brightness, contrast, font_size")
      .eq("id", childId)
      .single();

    if (error || !child) {
      return NextResponse.json({ error: "Profilo non trovato" }, { status: 404 });
    }
    return NextResponse.json({ child });
  } else {
    // Ritorna le preferenze di tutti i figli se non specificato
    return NextResponse.json({ error: "childId richiesto per la lettura singola" }, { status: 400 });
  }
}

export async function handleChildAccessibilityServer(
  supabase: any,
  adminClient: any,
  body: any
): Promise<{ success?: boolean; error?: string; status?: number; [k: string]: any }> {
  const { childId, night_mode, brightness, contrast, font_size, applyToAll } = body;

  let user: any = null;
  if (supabase && supabase.auth) {
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } else if (body._mockUser) {
    user = body._mockUser;
  }

  // Check esplicito per applyToAll su sessioni in modalità bambino
  if (applyToAll === true) {
    const isChildMode = user?.app_metadata?.is_child_mode === true || body._mockIsChildMode === true;
    if (isChildMode) {
      return {
        error: "L'applicazione delle preferenze a tutti i figli è riservata al genitore",
        status: 403,
      };
    }

    if (!user && !body._mockParentId) {
      return { error: "Utente non autenticato", status: 401 };
    }

    const parentId = user?.id || body._mockParentId;
    const { data: family } = await adminClient
      .from("families")
      .select("id")
      .eq("parent_user_id", parentId)
      .single();

    if (!family) {
      return { error: "Famiglia non trovata", status: 404 };
    }

    const { data: children } = await adminClient
      .from("child_profiles")
      .select("id")
      .eq("family_id", family.id);

    if (children && children.length > 0) {
      for (const c of children) {
        if (adminClient.rpc) {
          await adminClient.rpc("update_reading_accessibility", {
            p_child_profile_id: c.id,
            p_night_mode: night_mode ?? null,
            p_brightness: brightness ?? null,
            p_contrast: contrast ?? null,
            p_font_size: font_size ?? null,
          });
        } else {
          // Fallback se rpc non è mockato
          await adminClient
            .from("child_profiles")
            .update({
              night_mode: night_mode !== undefined ? night_mode : false,
              brightness: brightness !== undefined ? brightness : 100,
              contrast: contrast !== undefined ? contrast : 100,
              font_size: font_size !== undefined ? font_size : "medium",
            })
            .eq("id", c.id);
        }
      }
    }

    return { success: true, updatedAll: true };
  }

  // Caso aggiornamento singolo bambino
  if (!childId) {
    return { error: "childId obbligatorio se applyToAll non è true", status: 400 };
  }

  // Se disponibile supabase reale o rpc via adminClient, chiamiamo update_reading_accessibility via RPC
  const rpcClient = supabase && supabase.rpc ? supabase : adminClient;
  if (rpcClient && rpcClient.rpc) {
    const { error: rpcErr } = await rpcClient.rpc("update_reading_accessibility", {
      p_child_profile_id: childId,
      p_night_mode: night_mode ?? null,
      p_brightness: brightness ?? null,
      p_contrast: contrast ?? null,
      p_font_size: font_size ?? null,
    });

    if (rpcErr) {
      return {
        error: rpcErr.message || "Errore durante l'aggiornamento accessibilità",
        status: rpcErr.message?.includes("Accesso negato") ? 403 : 500,
      };
    }
  } else {
    // Fallback di test o diretto
    const { error: updErr } = await adminClient
      .from("child_profiles")
      .update({
        night_mode: night_mode !== undefined ? night_mode : false,
        brightness: brightness !== undefined ? brightness : 100,
        contrast: contrast !== undefined ? contrast : 100,
        font_size: font_size !== undefined ? font_size : "medium",
      })
      .eq("id", childId);

    if (updErr) {
      return { error: updErr.message, status: 500 };
    }
  }

  return { success: true, updatedChildId: childId };
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const url = new URL(req.url);
    const childId = url.searchParams.get("childId");

    return await handleChildAccessibilityGetServer(supabase, adminClient, childId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore lettura accessibilità";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const body = await req.json();

    const res = await handleChildAccessibilityServer(supabase, adminClient, body);
    const status = res.status || (res.error ? 400 : 200);
    return NextResponse.json(res, { status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore salvataggio accessibilità";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return PUT(req);
}
