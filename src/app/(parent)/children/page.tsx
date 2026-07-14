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

interface ChildProfile {
  id: string;
  name: string;
  birth_year?: number;
  avatar_preset_id?: string;
  adventure_points?: number;
}

export default function ChildrenPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);

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

    const { data } = await supabase
      .from("child_profiles")
      .select("*")
      .order("created_at", { ascending: true });

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

    setIsCreating(true);

    try {
      if (editingChildId) {
        const { error: updErr } = await supabase
          .from("child_profiles")
          .update({
            name: name.trim(),
            birth_year: birthYear ? parseInt(birthYear) : null,
            avatar_preset_id: selectedAvatar,
          })
          .eq("id", editingChildId);

        if (updErr) throw new Error(updErr.message);
        handleCancelEdit();
      } else {
        let activeFamilyId = familyId;
        if (!activeFamilyId) {
          const { data: authData } = await supabase.auth.getUser();
          if (!authData.user) {
            throw new Error("Devi effettuare l'accesso per aggiungere figli.");
          }
          const { data: fam } = await supabase
            .from("families")
            .select("id")
            .eq("parent_user_id", authData.user.id)
            .single();

          if (fam) {
            activeFamilyId = fam.id;
            setFamilyId(fam.id);
          } else {
            const { data: newFam, error: insFamErr } = await supabase
              .from("families")
              .insert({ parent_user_id: authData.user.id })
              .select("id")
              .single();

            if (insFamErr || !newFam) {
              throw new Error(insFamErr?.message || "Errore creazione famiglia");
            }
            activeFamilyId = newFam.id;
            setFamilyId(newFam.id);
          }
        }

        const { error: insErr } = await supabase.from("child_profiles").insert({
          family_id: activeFamilyId,
          name: name.trim(),
          birth_year: birthYear ? parseInt(birthYear) : null,
          avatar_preset_id: selectedAvatar,
        });

        if (insErr) {
          throw new Error(insErr.message);
        }

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
                <Link href="/billing" className="btn-primary text-xs w-full text-center py-3">
                  ★ Upgrade Piano
                </Link>
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
                min={2014}
                max={2026}
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
          <div className="glass-card p-5 border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-indigo-500/10">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-white text-sm">
                  Punti Avventura & Gamification
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  I bambini guadagnano <strong className="text-amber-300">+15 Punti Avventura</strong> per ogni storia completata, oltre a punti bonus completando le <strong className="text-indigo-300">Missioni di Lettura</strong> nell&apos;area bambino (<code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">/read</code>). Con i punti possono sbloccare distintivi e cornici nel Negozio Premi!
                </p>
              </div>
            </div>
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
                    <img
                      src={getAvatarUrl(child.avatar_preset_id)}
                      alt={child.name}
                      className="w-12 h-12 rounded-2xl bg-slate-900/80 border border-indigo-500/30 p-1 object-contain"
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
                      onClick={() => handleStartEdit(child)}
                      className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors"
                      title="Modifica profilo"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
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
    </div>
  );
}
