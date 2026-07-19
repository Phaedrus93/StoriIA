import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { APP_CONFIG } from "@/lib/config";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("avatar_presets")
      .select("id, name, image_url, gender, is_free, is_active, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return NextResponse.json({ presets: APP_CONFIG.defaultAvatarPresets });
    }

    // Normalizziamo per assicurarci che imageUrl e image_url siano sempre accessibili
    const normalized = data.map((p: any) => ({
      ...p,
      imageUrl: p.image_url || p.imageUrl || "/avatars/explorer.svg",
      image_url: p.image_url || p.imageUrl || "/avatars/explorer.svg",
      gender: p.gender || "neutral",
    }));

    return NextResponse.json({ presets: normalized });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore recupero preset avatar";
    return NextResponse.json({ presets: APP_CONFIG.defaultAvatarPresets, error: message }, { status: 200 });
  }
}
