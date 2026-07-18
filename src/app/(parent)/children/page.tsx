"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { APP_CONFIG } from "@/lib/config";
import {
  BookOpen,
  Sparkles,
  UserPlus,
  Trash2,
  KeyRound,
  Edit2,
  X,
  Check,
  Users,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { getAvatarUrl } from "@/lib/avatars";
import ConfirmationModal from "@/components/ConfirmationModal";
import { ChildAvatarWithBadge } from "@/components/ChildAvatarWithBadge";
import GamificationModal from "@/app/(child)/read/components/GamificationModal";

const TIER_RANK: Record<string, number> = { free: 1, premium: 2, family: 3 };

interface ChildProfile {
  id: string;
  name: string;
  birth_year?: number;
  avatar_preset_id?: string;
  adventure_points?: number;
  active_badge_id?: string | null;
  active_frame_id?: string | null;
}

export default function ChildrenPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [cosmeticsMap, setCosmeticsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);

  // Stato per il negozio gamification e contenuti
  const [showGamificationModal, setShowGamificationModal] = useState(false);
  const [gamificationData, setGamificationData] = useState<any>(null);
  const [selectedGamificationChildId, setSelectedGamificationChildId] = useState<string>("");

  // Stato per la modale di conferma eliminazione
  const [deleteChildId, setDeleteChildId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Limiti piano
  const [canAddChild, setCanAddChild] = useState<boolean>(true);
  const [childLimitInfo, setChildLimitInfo] = useState<{
    currentCount: number; maxAllowed: number; tier: string; addonCount: number;
  } | null>(null);

  // Form Creazione / Modifica Figlio
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string>(APP_CONFIG.defaultAvatarPresets[0].id);
  const [isCreating, setIsCreating] = useState(false);

  const supabase = createClient();

  const checkChildLimit = useCallback(async () => {
    try {
      const res = await fetch("/api/family/check-child-limit");
      if (res.ok) {
        const info = await res.json();
        setCanAddChild(info.canAdd);
        setChildLimitInfo(info);
      }
    } catch {
      // ignora
    }
  }, []);

  useEffect(() => {
    loadChildren();
    checkChildLimit();
  }, [checkChildLimit]);

  async function loadChildren() {
    setLoading(true);
    const { data: familyData } = await supabase.from("families").select("id").single();
    if (familyData) setFamilyId(familyData.id);

    const [{ data }, { data: cosmData }] = await Promise.all([
      supabase.from("child_profiles").select("*").order("created_at", { ascending: true }),
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
    // Ricontrolla limite dopo ogni ricarica
    checkChildLimit();
  }

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartEdit = (child: ChildProfile) => {
    setEditingChildId(child.id);
    setName(child.name);
    setBirthYear(child.birth_year ? child.birth_year.toString() : "");
    setSelectedAvatar(child.avatar_preset_id || APP_CONFIG.defaultAvatarPresets[0].id);
    setErrorMessage(null);
  };

  const handleCancelEdit = () => {
    setEditingChildId(null);
    setName("");
    setBirthYear("");
    setSelectedAvatar(APP_CONFIG.defaultAvatarPresets[0].id);
    setErrorMessage(null);
  };

  const handleAddOrEditChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Inserisci il nome del bambino.");
      return;
    }

    if (!birthYear || isNaN(parseInt(birthYear)) || parseInt(birthYear) < 2000 || parseInt(birthYear) > 2100) {
      setErrorMessage("L'anno di nascita è obbligatorio e deve essere un anno valido.");
      return;
    }

    setIsCreating(true);

    try {
      const parsedYear = parseInt(birthYear);
      if (editingChildId) {
        const res = await fetch("/api/family/child-profiles", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingChildId,
            name: name.trim(),
            birth_year: parsedYear,
            avatar_preset_id: selectedAvatar,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Impossibile aggiornare il profilo.");
        handleCancelEdit();
      } else {
        const res = await fetch("/api/family/child-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            birth_year: parsedYear,
            avatar_preset_id: selectedAvatar,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Impossibile salvare il profilo.");
        setName("");
        setBirthYear("");
      }
      loadChildren();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Impossibile salvare il profilo."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const executeDeleteChild = async (id: string) => {
    setDeleting(true);
    try {
      await supabase.from("child_profiles").delete().eq("id", id);
      loadChildren();
    } finally {
      setDeleting(false);
      setDeleteChildId(null);
    }
  };

  const handleDeleteChild = (id: string) => {
    setDeleteChildId(id);
  };

  const loadChildGamification = async (childId: string) => {
    setSelectedGamificationChildId(childId);
    try {
      const res = await fetch(`/api/child/gamification?childId=${childId}`);
      if (res.ok) {
        const data = await res.json();
        setGamificationData(data);
      }
    } catch (e) {
      console.error("Errore caricamento gamification:", e instanceof Error ? e.message : "errore sconosciuto");
    }
  };

  const handleOpenGamification = (childId?: string) => {
    const targetId = childId || (children.length > 0 ? children[0].id : "");
    if (!targetId) return;
    loadChildGamification(targetId);
    setShowGamificationModal(true);
  };

  const handleParentUnlockCosmetic = async (cosmeticId: string) => {
    if (!selectedGamificationChildId) return;
    const res = await fetch("/api/child/gamification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock_cosmetic", childId: selectedGamificationChildId, cosmeticId }),
    });
    if (res.ok) {
      await loadChildGamification(selectedGamificationChildId);
      loadChildren();
    } else {
      const err = await res.json();
      alert(err.error || "Errore nello sblocco");
    }
  };

  const handleParentUnlockNarrative = async (contentId: string) => {
    if (!selectedGamificationChildId) return;
    const res = await fetch("/api/child/gamification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock_narrative_content", childId: selectedGamificationChildId, contentId }),
    });
    if (res.ok) {
      await loadChildGamification(selectedGamificationChildId);
      loadChildren();
    } else {
      const err = await res.json();
      alert(err.error || "Errore nello sblocco del contenuto narrativo");
    }
  };

  const handleParentSetActiveCosmetic = async (slot: "badge" | "frame", cosmeticId: string | null) => {
    if (!selectedGamificationChildId) return;
    const res = await fetch("/api/child/gamification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_active_cosmetic", childId: selectedGamificationChildId, slot, cosmeticId }),
    });
    if (res.ok) {
      await loadChildGamification(selectedGamificationChildId);
      loadChildren();
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/dashboard"
          className="text-xs font-semibold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 mb-3"
        >
          ← Torna alla Dashboard Genitore
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-400" />
          <span>Gestione Profili Figli</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Aggiungi i tuoi figli per creare e assegnare loro storie personalizzate.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Creazione / Modifica Figlio */}
        <div className="glass-card p-6 lg:col-span-1 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-400" />
            <span>{editingChildId ? "Modifica Profilo" : "Aggiungi Profilo"}</span>
          </h2>

          {/* Banner info piano */}
          {childLimitInfo && (
            <div className={`p-3 rounded-xl text-xs border ${
              canAddChild
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                : "bg-amber-500/10 border-amber-500/30 text-amber-300"
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  Profili: {childLimitInfo.currentCount} / {childLimitInfo.maxAllowed}
                  {childLimitInfo.addonCount > 0 && ` (+${childLimitInfo.addonCount} add-on)`}
                </span>
                <span className="uppercase font-bold text-[10px] opacity-70">
                  Piano {childLimitInfo.tier}
                </span>
              </div>
            </div>
          )}

          {/* Blocco form se limite raggiunto */}
          {!canAddChild && !editingChildId ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm space-y-2">
                <p className="font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Limite profili raggiunto
                </p>
                <p className="text-xs text-amber-300/80 leading-relaxed">
                  Con il piano <strong>{childLimitInfo?.tier?.toUpperCase()}</strong> puoi gestire fino a <strong>{childLimitInfo?.maxAllowed}</strong> profil{childLimitInfo?.maxAllowed === 1 ? "o" : "i"} bambino.
                  Fai l&apos;upgrade o aggiungi uno slot aggiuntivo per continuare.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {(TIER_RANK[childLimitInfo?.tier || "free"] || 1) < TIER_RANK.family && (
                  <Link href="/billing" className="btn-primary text-xs w-full text-center py-3">
                    ★ Upgrade Piano
                  </Link>
                )}
                <Link href="/billing#addon" className="btn-secondary text-xs w-full text-center py-2.5 text-amber-300 border-amber-500/40">
                  + Aggiungi Slot Add-on (€1.99/mese)
                </Link>
              </div>
            </div>
          ) : (
            <>
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleAddOrEditChild} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Nome Bambino
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Sofia"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Anno di Nascita
              </label>
              <input
                type="number"
                required
                min={2000}
                max={2100}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="es. 2019"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Scegli Avatar Gratuito
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {APP_CONFIG.defaultAvatarPresets.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar.id)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                      selectedAvatar === avatar.id
                        ? "border-indigo-500 bg-indigo-500/20 text-white shadow-md shadow-indigo-500/20 ring-2 ring-indigo-500/50"
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:bg-slate-800/50"
                    }`}
                  >
                    <img
                      src={getAvatarUrl(avatar.id)}
                      alt={avatar.name}
                      className="w-12 h-12 object-contain rounded-xl p-1"
                    />
                    <span className="block text-[11px] font-medium mt-1 truncate w-full">{avatar.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button type="submit" disabled={isCreating} className="btn-primary flex-1">
                <Sparkles className="w-4 h-4" />
                <span>{isCreating ? "Salvataggio..." : editingChildId ? "Salva Modifiche" : "Crea Profilo Figlio"}</span>
              </button>
              {editingChildId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn-secondary px-3 text-xs"
                >
                  Annulla
                </button>
              )}
            </div>
          </form>
            </>
          )}
        </div>

        {/* Elenco Profili */}
        <div className="lg:col-span-2 space-y-4">
          {/* Banner Gamification info per i genitori */}
          <div className="glass-card p-5 border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-indigo-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-white text-sm">
                  Punti Avventura, Gamification & Contenuti Narrativi
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  I bambini guadagnano <strong className="text-amber-300">+15 Punti Avventura</strong> per ogni storia completata, oltre a punti bonus con le <strong className="text-indigo-300">Missioni di Lettura</strong>. Con i punti possono sbloccare badge, cornici e <strong className="text-amber-300">tratti e stili narrativi</strong> per tutta la famiglia!
                </p>
              </div>
            </div>
            {children.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenGamification(children[0].id)}
                className="btn-primary text-xs shrink-0 flex items-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-indigo-500 hover:opacity-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Apri Negozio & Premi</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="glass-card p-8 animate-pulse text-center text-slate-400">
              Caricamento profili...
            </div>
          ) : children.length === 0 ? (
            <div className="glass-card p-12 text-center text-slate-400">
              Nessun figlio registrato. Usa il form a sinistra per aggiungere il primo profilo.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {children.map((child) => (
                <div key={child.id} className="glass-card p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ChildAvatarWithBadge
                      name={child.name}
                      avatarPresetId={child.avatar_preset_id}
                      activeBadgeId={child.active_badge_id}
                      activeFrameId={child.active_frame_id}
                      cosmeticsMap={cosmeticsMap}
                      size="md"
                    />
                    <div>
                      <h3 className="font-bold text-white">{child.name}</h3>
                      {child.birth_year && (
                        <p className="text-xs text-slate-400">Classe {child.birth_year}</p>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full mt-1">
                        ★ {child.adventure_points || 0} pt
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenGamification(child.id)}
                      className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-xl transition-colors"
                      title="Negozio Gamification & Contenuti"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(child)}
                      className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors"
                      title="Modifica profilo"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteChild(child.id)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                      title="Elimina profilo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={Boolean(deleteChildId)}
        title="Conferma Eliminazione Profilo"
        message="Sei sicuro di voler eliminare definitivamente questo profilo bambino e tutte le sue impostazioni?"
        confirmLabel="Elimina Profilo"
        variant="danger"
        isLoading={deleting}
        onConfirm={() => deleteChildId && executeDeleteChild(deleteChildId)}
        onClose={() => setDeleteChildId(null)}
      />

      <GamificationModal
        isOpen={showGamificationModal && Boolean(gamificationData)}
        onClose={() => setShowGamificationModal(false)}
        adventurePoints={gamificationData?.child?.adventure_points || 0}
        quests={gamificationData?.quests || []}
        questProgress={gamificationData?.progress || []}
        cosmetics={gamificationData?.cosmetics || []}
        unlockedCosmetics={gamificationData?.unlocked || []}
        narrativeCatalog={gamificationData?.narrativeCatalog || []}
        unlockedNarrative={gamificationData?.unlockedNarrative || []}
        familyTier={gamificationData?.familyTier || "free"}
        activeBackdrop={gamificationData?.child?.active_badge_id || null}
        activeFrame={gamificationData?.child?.active_frame_id || null}
        childId={selectedGamificationChildId}
        childrenList={children.map((ch) => ({
          id: ch.id,
          name: ch.name,
          adventure_points: ch.adventure_points || 0,
        }))}
        onSelectChild={loadChildGamification}
        onUnlockCosmetic={handleParentUnlockCosmetic}
        onUnlockNarrative={handleParentUnlockNarrative}
        onSetActiveCosmetic={handleParentSetActiveCosmetic}
        onPointsUpdate={(pts) => {
          if (gamificationData?.child) {
            setGamificationData({
              ...gamificationData,
              child: { ...gamificationData.child, adventure_points: pts },
            });
          }
        }}
        rewardToast={null}
        isChildMode={false}
      />
    </div>
  );
}
