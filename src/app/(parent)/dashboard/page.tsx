"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Users, Sparkles, Plus, ArrowRight, ShieldCheck } from "lucide-react";
import { getAvatarUrl } from "@/lib/avatars";
import { ChildAvatarWithBadge } from "@/components/ChildAvatarWithBadge";

interface ChildProfile {
  id: string;
  name: string;
  birth_year?: number;
  avatar_preset_id?: string;
  adventure_points?: number;
  active_badge_id?: string | null;
  active_frame_id?: string | null;
}

export default function DashboardPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [cosmeticsMap, setCosmeticsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const [{ data }, { data: cosmData }] = await Promise.all([
        supabase
          .from("child_profiles")
          .select("id, name, birth_year, avatar_preset_id, adventure_points, active_badge_id, active_frame_id")
          .order("created_at", { ascending: true }),
        supabase.from("cosmetic_items").select("id, icon_preset"),
      ]);

      const map: Record<string, string> = {};
      if (cosmData) {
        cosmData.forEach((c: any) => {
          map[c.id] = c.icon_preset;
        });
      }
      setCosmeticsMap(map);
      setChildren(data || []);
      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="glass-card p-8 bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 border-indigo-500/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Pannello Famiglia Protetto</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Benvenuto in StoriIA</h1>
            <p className="text-slate-300 mt-2 max-w-2xl text-sm leading-relaxed">
              Crea racconti indimenticabili per stimolare la lettura attiva dei tuoi figli. Scegli un personaggio,
              un&apos;ambientazione e un insegnamento morale.
            </p>
          </div>
          <Link href="/stories/new" className="btn-primary shrink-0">
            <Sparkles className="w-4 h-4" />
            <span>Genera Nuova Storia AI</span>
          </Link>
        </div>
      </div>

      {/* Grid Profili Figli */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <span>Profili Figli ({children.length})</span>
          </h2>
          <Link href="/children" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <span>Gestisci tutti</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="glass-card p-6 animate-pulse h-32" />
            ))}
          </div>
        ) : children.length === 0 ? (
          <div className="glass-card p-8 text-center border-dashed">
            <p className="text-slate-400 mb-4">Non hai ancora aggiunto profili bambino.</p>
            <Link href="/children" className="btn-secondary">
              <Plus className="w-4 h-4" />
              <span>Aggiungi Primo Figlio</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {children.map((child) => (
              <div key={child.id} className="glass-card p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <ChildAvatarWithBadge
                    name={child.name}
                    avatarPresetId={child.avatar_preset_id}
                    activeBadgeId={child.active_badge_id}
                    activeFrameId={child.active_frame_id}
                    cosmeticsMap={cosmeticsMap}
                    size="md"
                  />
                  <div>
                    <h3 className="font-semibold text-white">{child.name}</h3>
                    {child.birth_year && (
                      <p className="text-xs text-slate-400">Anno di nascita: {child.birth_year}</p>
                    )}
                  </div>
                </div>
                <span className="flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-full shrink-0 shadow-sm">
                  ★ {child.adventure_points || 0} pt
                </span>
              </div>
            ))}
            <Link
              href="/children"
              className="glass-card p-5 flex flex-col items-center justify-center border-dashed border-slate-700 hover:border-indigo-500/50 text-slate-400 hover:text-indigo-300 transition-colors"
            >
              <Plus className="w-6 h-6 mb-1" />
              <span className="text-sm font-semibold">Aggiungi Profilo</span>
            </Link>
          </div>
        )}
      </div>

      {/* Scorciatoie di Creazione e Gestione */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
        <Link href="/library/characters" className="glass-card p-6 group">
          <h3 className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors">
            Personaggi
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Crea eroi e personaggi con tratti personalizzati.
          </p>
        </Link>

        <Link href="/library/settings" className="glass-card p-6 group">
          <h3 className="font-bold text-lg text-white group-hover:text-pink-400 transition-colors">
            Ambientazioni
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Definisci mondi fantastici e luoghi di avventura.
          </p>
        </Link>

        <Link href="/stories" className="glass-card p-6 group">
          <h3 className="font-bold text-lg text-white group-hover:text-amber-400 transition-colors">
            Le Mie Storie
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Sfoglia e assegna le favole ai tuoi figli.
          </p>
        </Link>

        <Link href="/billing" className="glass-card p-6 group border-indigo-500/30">
          <h3 className="font-bold text-lg text-white group-hover:text-emerald-400 transition-colors">
            Abbonamento & Crediti
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Gestisci piano, saldo crediti AI e ricariche.
          </p>
        </Link>
      </div>
    </div>
  );
}
