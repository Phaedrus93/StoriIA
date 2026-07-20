"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, ShieldAlert, ArrowLeft, CheckCircle2 } from "lucide-react";
import { getAvatarUrl } from "@/lib/avatars";
import { ChildAvatarWithBadge } from "@/components/ChildAvatarWithBadge";

interface ChildProfile {
  id: string;
  name: string;
  birth_year: number;
  avatar_preset_id: string | null;
  active_badge_id?: string | null;
  active_frame_id?: string | null;
  is_suspended?: boolean;
}

export default function ChildSelectPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [cosmeticsMap, setCosmeticsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadChildren();
  }, []);

  async function loadChildren() {
    setLoading(true);
    const [{ data }, { data: cosmData }] = await Promise.all([
      supabase
        .from("child_profiles")
        .select("id, name, birth_year, avatar_preset_id, active_badge_id, active_frame_id, is_suspended, created_at")
        .order("created_at", { ascending: true }),
      supabase.from("cosmetic_items").select("id, icon_preset"),
    ]);

    const map: Record<string, string> = {};
    if (cosmData) {
      cosmData.forEach((c: { id: string; icon_preset: string }) => {
        map[c.id] = c.icon_preset;
      });
    }
    setCosmeticsMap(map);
    const sorted = [...(data || [])].sort((a: any, b: any) => {
      if (Boolean(a.is_suspended) !== Boolean(b.is_suspended)) {
        return Boolean(a.is_suspended) ? 1 : -1;
      }
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });
    setChildren(sorted);
    setLoading(false);
  }

  const handleSelectProfile = async (child: ChildProfile) => {
    setSelectingId(child.id);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/child-mode/select-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childProfileId: child.id }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMsg(data.error || "Impossibile attivare il profilo selezionato.");
        setSelectingId(null);
        return;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("storiia_active_child_id", child.id);
      }

      // Refresh esplicito della sessione per far acquisire il nuovo claim JWT al client
      await supabase.auth.refreshSession();

      // Vai alla modalità lettura con il profilo selezionato
      router.push(`/read?childId=${child.id}`);
    } catch {
      setErrorMsg("Errore di connessione durante la selezione del profilo.");
      setSelectingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
      <div className="max-w-3xl w-full space-y-8">
        <div className="flex items-center justify-between">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Torna alla Dashboard Genitore</span>
          </a>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Attivazione Modalità Bambino</span>
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 text-indigo-400" />
            <span>Chi sta per leggere una favola?</span>
          </h1>
          <p className="text-sm text-slate-300 max-w-lg mx-auto">
            Scegli il profilo del bambino per accedere a un&apos;esperienza sicura, con le storie a lui assegnate e salvataggio automatico del progresso.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div className="glass-card p-16 text-center text-slate-400 animate-pulse">
            Caricamento profili in corso...
          </div>
        ) : children.length === 0 ? (
          <div className="glass-card p-12 text-center space-y-4">
            <p className="text-sm text-amber-300">
              Non hai ancora creato nessun profilo bambino per la tua famiglia.
            </p>
            <a href="/children" className="btn-primary inline-flex text-xs">
              Crea il Primo Profilo Bambino
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {children.map((child) => {
              const isSelecting = selectingId === child.id;
              const age = child.birth_year
                ? new Date().getFullYear() - child.birth_year
                : null;

              return (
                <button
                  key={child.id}
                  onClick={() => !child.is_suspended && handleSelectProfile(child)}
                  disabled={selectingId !== null || Boolean(child.is_suspended)}
                  className={`group relative text-left glass-card p-6 flex flex-col justify-between transition-all ${
                    child.is_suspended
                      ? "grayscale opacity-50 cursor-not-allowed border-slate-800 bg-slate-900/80"
                      : "hover:scale-[1.03] hover:border-indigo-500/60 hover:shadow-xl hover:shadow-indigo-500/20"
                  } ${isSelecting ? "border-indigo-500 bg-indigo-600/10" : ""}`}
                >
                  <div className="space-y-4">
                    <ChildAvatarWithBadge
                      name={child.name}
                      avatarPresetId={child.avatar_preset_id}
                      activeBadgeId={child.active_badge_id}
                      activeFrameId={child.active_frame_id}
                      cosmeticsMap={cosmeticsMap}
                      size="lg"
                      className={!child.is_suspended ? "group-hover:scale-110 transition-transform" : ""}
                    />
                    <div>
                      <h2 className={`text-xl font-bold text-white transition-colors ${!child.is_suspended ? "group-hover:text-indigo-300" : ""}`}>
                        {child.name}
                      </h2>
                      {age !== null && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {age} anni
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={`mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold ${
                    child.is_suspended ? "text-rose-400" : "text-indigo-400 group-hover:text-indigo-300"
                  }`}>
                    <span>{child.is_suspended ? "🔒 Profilo Sospeso" : isSelecting ? "Avvio..." : "Entra nell'area"}</span>
                    {isSelecting && <CheckCircle2 className="w-4 h-4 animate-spin" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
