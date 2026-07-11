"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { APP_CONFIG } from "@/lib/config";
import { hashPinAction } from "@/app/actions/pin";
import { Users, Plus, Trash2, ShieldCheck, KeyRound, Sparkles, Edit2 } from "lucide-react";

interface ChildProfile {
  id: string;
  name: string;
  birth_year?: number;
  avatar_preset_id?: string;
}

export default function ChildrenPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);

  // Form Creazione / Modifica Figlio
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string>(APP_CONFIG.defaultAvatarPresets[0].id);
  const [isCreating, setIsCreating] = useState(false);

  // Form Impostazione PIN
  const [newPin, setNewPin] = useState("");
  const [pinStatus, setPinStatus] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadChildren();
  }, []);

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

  const handleDeleteChild = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo profilo?")) return;
    await supabase.from("child_profiles").delete().eq("id", id);
    loadChildren();
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinStatus(null);
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinStatus("Il PIN deve essere di 4-6 cifre numeriche.");
      return;
    }

    try {
      let activeFamilyId = familyId;
      if (!activeFamilyId) {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) {
          throw new Error("Devi effettuare l'accesso per impostare il PIN.");
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
            throw new Error("Famiglia non trovata. Crea prima un profilo figlio.");
          }
          activeFamilyId = newFam.id;
          setFamilyId(newFam.id);
        }
      }

      const pinHash = await hashPinAction(newPin);
      const { error: rpcError } = await supabase.rpc("set_parent_pin_hash", {
        p_family_id: activeFamilyId,
        p_pin_hash: pinHash,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setNewPin("");
      setPinStatus("PIN aggiornato con successo! Proteggerà l'uscita dalla modalità bambino.");
    } catch (err: unknown) {
      setPinStatus(
        err instanceof Error
          ? `Errore PIN: ${err.message}`
          : "Errore durante l'aggiornamento del PIN."
      );
    }
  };

  return (
    <div className="space-y-10">
      <div>
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
              <div className="grid grid-cols-3 gap-2">
                {APP_CONFIG.defaultAvatarPresets.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar.id)}
                    className={`p-2 rounded-xl border text-center text-xs transition-all ${
                      selectedAvatar === avatar.id
                        ? "border-indigo-500 bg-indigo-500/20 text-white"
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="block font-semibold mt-1 truncate">{avatar.name}</span>
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
        </div>

        {/* Elenco Profili */}
        <div className="lg:col-span-2 space-y-4">
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
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center font-bold text-lg text-white">
                      {child.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{child.name}</h3>
                      {child.birth_year && (
                        <p className="text-xs text-slate-400">Classe {child.birth_year}</p>
                      )}
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

          {/* Scheda di Sicurezza PIN Genitore */}
          <div className="glass-card p-6 mt-8 border-indigo-500/20">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold">Imposta o Aggiorna PIN Genitore</h2>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Questo PIN a 4-6 cifre verrà richiesto per uscire dalla Modalità Bambino e tornare all&apos;Area Genitore.
            </p>

            {pinStatus && (
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm mb-4">
                {pinStatus}
              </div>
            )}

            <form onSubmit={handleUpdatePin} className="flex gap-3 max-w-sm">
              <input
                type="password"
                maxLength={6}
                required
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="4-6 cifre"
                className="input-field"
              />
              <button type="submit" className="btn-primary shrink-0">
                <ShieldCheck className="w-4 h-4" />
                <span>Salva PIN</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
