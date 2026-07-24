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
  Lock,
  Play,
  Pause,
  AlertTriangle,
} from "lucide-react";
import { getAvatarUrl, registerDynamicAvatarPresets } from "@/lib/avatars";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import ConfirmationModal from "@/components/ConfirmationModal";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ChildAvatarWithBadge } from "@/components/ChildAvatarWithBadge";
import GamificationModal from "@/app/(child)/read/components/GamificationModal";

const TIER_RANK: Record<string, number> = { free: 1, premium: 2, family: 3 };

interface ChildProfile {
  id: string;
  name: string;
  birth_year?: number;
  gender?: string;
  avatar_preset_id?: string;
  adventure_points?: number;
  active_badge_id?: string | null;
  active_frame_id?: string | null;
  is_suspended?: boolean;
}

export default function ChildrenPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [cosmeticsMap, setCosmeticsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);

  // Preset avatar dinamici dal database (tutti gli attivi)
  const [avatarPresets, setAvatarPresets] = useState<any[]>([...APP_CONFIG.defaultAvatarPresets]);

  // Stato per il negozio gamification e contenuti
  const [showGamificationModal, setShowGamificationModal] = useState(false);
  const [gamificationData, setGamificationData] = useState<any>(null);
  const [selectedGamificationChildId, setSelectedGamificationChildId] = useState<string>("");

  // Stato per la modale di conferma eliminazione
  const [deleteChildId, setDeleteChildId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [suspensionLoading, setSuspensionLoading] = useState<string | null>(null);

  // Limiti piano
  const [canAddChild, setCanAddChild] = useState<boolean>(true);
  const [childLimitInfo, setChildLimitInfo] = useState<{
    currentCount: number; maxAllowed: number; tier: string; addonCount: number;
  } | null>(null);

  // Form Creazione / Modifica Figlio
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState("neutral");
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

    // Carichiamo anche i preset avatar attivi dal DB
    let presetsList: any[] = [...APP_CONFIG.defaultAvatarPresets];
    try {
      const resPresets = await fetch("/api/family/avatar-presets");
      if (resPresets.ok) {
        const pData = await resPresets.json();
        if (pData?.presets && pData.presets.length > 0) {
          presetsList = pData.presets;
          registerDynamicAvatarPresets(presetsList);
        }
      }
    } catch {
      // fallback su defaultAvatarPresets
    }
    setAvatarPresets(presetsList);

    const [{ data }, { data: cosmData }] = await Promise.all([
      supabase.from("child_profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("cosmetic_items").select("*"),
    ]);

    const map: Record<string, any> = {};
    if (cosmData) {
      cosmData.forEach((c: any) => {
        map[c.id] = c;
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
    // Ricontrolla limite dopo ogni ricarica
    checkChildLimit();
  }

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const handleReactivateChild = async (child: ChildProfile) => {
    setSuspensionLoading(child.id);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/child/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: child.id }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadChildren();
      } else if (data.requiresUpgrade) {
        setConfirmConfig({
          isOpen: true,
          title: "Piano da Estendere",
          message: data.error + "\n\nVuoi andare subito alla pagina Abbonamenti per estendere il tuo piano?",
          onConfirm: () => {
            window.location.href = "/billing";
          }
        });
      } else {
        alert(data.error || "Errore nella riattivazione del profilo");
      }
    } catch {
      alert("Errore di rete durante la riattivazione");
    } finally {
      setSuspensionLoading(null);
    }
  };

  const handleStartCreate = () => {
    handleCancelEdit();
    setIsFormOpen(true);
  };

  const handleStartEdit = (child: ChildProfile) => {
    setEditingChildId(child.id);
    setName(child.name);
    setBirthYear(child.birth_year ? child.birth_year.toString() : "");
    const cGender = child.gender || "neutral";
    setGender(cGender);
    setSelectedAvatar(child.avatar_preset_id || avatarPresets[0]?.id || APP_CONFIG.defaultAvatarPresets[0].id);
    setErrorMessage(null);
    setIsFormOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingChildId(null);
    setName("");
    setBirthYear("");
    setGender("neutral");
    setSelectedAvatar(avatarPresets[0]?.id || APP_CONFIG.defaultAvatarPresets[0].id);
    setErrorMessage(null);
    setIsFormOpen(false);
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
            gender: gender,
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
            gender: gender,
            avatar_preset_id: selectedAvatar,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Impossibile salvare il profilo.");
        setName("");
        setBirthYear("");
        setGender("neutral");
        setIsFormOpen(false);
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

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-card p-5 border-indigo-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white">Profili Attivi: {children.length}</h2>
              {childLimitInfo && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  canAddChild
                    ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                    : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                }`}>
                  {childLimitInfo.currentCount} / {childLimitInfo.maxAllowed}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Piano attuale: <strong className="text-slate-200 uppercase">{childLimitInfo?.tier || "FREE"}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {!canAddChild ? (
            <Link href="/billing" className="btn-primary text-xs !py-2.5 !px-4 flex items-center justify-center gap-2 w-full sm:w-auto">
              <Sparkles className="w-4 h-4" />
              <span>Aumenta Limite / Upgrade</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleStartCreate}
              className="btn-primary text-xs !py-2.5 !px-4 flex items-center justify-center gap-2 w-full sm:w-auto shadow-md shadow-indigo-500/20"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Aggiungi Profilo</span>
            </button>
          )}
        </div>
      </div>



      {/* Elenco Profili */}
      {loading ? (
        <div className="glass-card p-8 animate-pulse text-center text-slate-400">
          Caricamento profili...
        </div>
      ) : children.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-400 border-dashed space-y-4">
          <p>Nessun figlio registrato. Clicca su &quot;+ Aggiungi Profilo&quot; per iniziare.</p>
          {canAddChild && (
            <button type="button" onClick={handleStartCreate} className="btn-secondary text-xs">
              <Plus className="w-4 h-4 mr-1 inline" /> Aggiungi Primo Figlio
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map((child) => (
            <div key={child.id} className={`glass-card p-5 flex flex-col justify-between gap-4 transition-all ${child.is_suspended ? 'border-slate-800 bg-slate-900/80 shadow-inner' : ''}`}>
              <div className={`flex items-start justify-between gap-3 ${child.is_suspended ? 'grayscale opacity-50 select-none pointer-events-none' : ''}`}>
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
                    <h3 className="font-bold text-white flex items-center gap-1.5">
                      <span>{child.name}</span>
                    </h3>
                    <span className="text-xs font-normal text-slate-400 block">
                      {child.gender === "boy" ? "👦 Maschio" : child.gender === "girl" ? "👧 Femmina" : "🧒 Neutro"}
                    </span>
                    {child.birth_year && (
                      <p className="text-xs text-slate-400 mt-0.5">Classe {child.birth_year}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full">
                    ★ {child.adventure_points || 0} pt
                  </span>
                  {child.is_suspended && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" />
                      <span>Sospeso</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {child.is_suspended ? (
                    <button
                      type="button"
                      onClick={() => handleReactivateChild(child)}
                      disabled={suspensionLoading === child.id}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                      title="Riattiva questo profilo"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Riattiva</span>
                    </button>
                  ) : (
                    <>
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
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteChild(child.id)}
                    className={`p-2 rounded-xl transition-all ${
                      child.is_suspended
                        ? "text-slate-500 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 hover:text-rose-400 hover:bg-rose-500/10"
                        : "text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                    }`}
                    title="Elimina profilo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={() => {
          confirmConfig.onConfirm();
          setConfirmConfig({ ...confirmConfig, isOpen: false });
        }}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        confirmLabel="Vai agli Abbonamenti"
        cancelLabel="Annulla"
        variant="info"
      />

      {/* Form Dialog/Sheet per Aggiungere o Modificare */}
      <ResponsiveModal
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) handleCancelEdit();
          setIsFormOpen(open);
        }}
        title={editingChildId ? "Modifica Profilo Figlio" : "Aggiungi Profilo Figlio"}
        description="I profili servono per generare storie adatte all'età e raccogliere Punti Avventura."
        footer={
          <>
            <button 
              type="button" 
              disabled={isCreating} 
              onClick={() => {
                const form = document.getElementById("child-profile-form") as HTMLFormElement;
                form?.requestSubmit();
              }}
              className="btn-primary flex-1"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isCreating ? "Salvataggio..." : editingChildId ? "Salva Modifiche" : "Crea Profilo Figlio"}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="btn-secondary px-4 text-xs"
            >
              Annulla
            </button>
          </>
        }
      >
        <div className="pb-4">
          <form id="child-profile-form" onSubmit={handleAddOrEditChild} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {errorMessage}
              </div>
            )}
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
              Genere / Sesso
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "neutral", label: "🧒 Neutro" },
                { id: "boy", label: "👦 Maschio" },
                { id: "girl", label: "👧 Femmina" },
              ].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setGender(g.id);
                    const valid = avatarPresets.filter(
                      (a) => !a.gender || a.gender === "neutral" || a.gender === g.id
                    );
                    if (valid.length > 0 && !valid.some((v) => v.id === selectedAvatar)) {
                      setSelectedAvatar(valid[0].id);
                    }
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all ${
                    gender === g.id
                      ? "border-indigo-500 bg-indigo-500/20 text-white shadow-md shadow-indigo-500/20 ring-1 ring-indigo-500/50"
                      : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Scegli Avatar Gratuito
            </label>
            <div className="grid grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
              {(avatarPresets.filter(
                (a) => !a.gender || a.gender === "neutral" || a.gender === gender
              ).length > 0
                ? avatarPresets.filter(
                    (a) => !a.gender || a.gender === "neutral" || a.gender === gender
                  )
                : avatarPresets
              ).map((avatar) => (
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

          </form>
        </div>
      </ResponsiveModal>

      <AlertDialog open={Boolean(deleteChildId)} onOpenChange={(open) => !open && setDeleteChildId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione Profilo</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare definitivamente questo profilo bambino e tutte le sue impostazioni e storie assegnate? L&apos;azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteChildId && executeDeleteChild(deleteChildId)}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500"
            >
              {deleting ? "Eliminazione..." : "Elimina Profilo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
