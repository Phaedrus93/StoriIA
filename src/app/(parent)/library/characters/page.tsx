"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, Plus, Trash2, UserCheck, AlertTriangle, X, Edit2 } from "lucide-react";
import { evaluatePreDeleteCheck } from "@/lib/library/delete-helper";

interface ChildProfile {
  id: string;
  name: string;
}

interface Character {
  id: string;
  name: string;
  traits: string;
  owner_child_profile_id: string;
  created_at: string;
}

const PRESET_TRAITS = [
  "Coraggioso",
  "Curioso",
  "Gentile",
  "Amante degli animali",
  "Ingegnoso",
  "Simpatico",
  "Generoso",
  "Sognatore",
  "Esploratore",
  "Amante della scienza",
];

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form Creazione / Modifica
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [ownerChildId, setOwnerChildId] = useState("");
  const [name, setName] = useState("");
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [customTrait, setCustomTrait] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Modale di conferma eliminazione per entità usate in storie
  const [deleteCandidate, setDeleteCandidate] = useState<{
    id: string;
    name: string;
    storyCount: number;
  } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: fam } = await supabase.from("families").select("id").single();
    if (fam) setFamilyId(fam.id);

    const { data: childData } = await supabase
      .from("child_profiles")
      .select("id, name")
      .order("created_at", { ascending: true });
    setChildren(childData || []);

    if (childData && childData.length > 0) {
      setOwnerChildId(childData[0].id);
    }

    const { data: charData } = await supabase
      .from("characters")
      .select("*")
      .order("created_at", { ascending: false });
    setCharacters(charData || []);

    setLoading(false);
  }

  const toggleTrait = (trait: string) => {
    if (selectedTraits.includes(trait)) {
      setSelectedTraits(selectedTraits.filter((t) => t !== trait));
    } else {
      setSelectedTraits([...selectedTraits, trait]);
    }
  };

  const handleStartEdit = (char: Character) => {
    setEditingCharId(char.id);
    setName(char.name);
    setOwnerChildId(char.owner_child_profile_id);
    setCustomTrait(char.traits);
    setSelectedTraits([]);
  };

  const handleCancelEdit = () => {
    setEditingCharId(null);
    setName("");
    setCustomTrait("");
    setSelectedTraits([]);
  };

  const handleAddOrEditCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ownerChildId || !familyId) return;

    setIsCreating(true);
    const combinedTraits = [
      ...selectedTraits,
      ...(customTrait.trim() ? [customTrait.trim()] : []),
    ].join(", ");

    if (!combinedTraits) {
      alert("Seleziona o inserisci almeno un tratto per il personaggio.");
      setIsCreating(false);
      return;
    }

    if (editingCharId) {
      await supabase
        .from("characters")
        .update({
          name: name.trim(),
          traits: combinedTraits,
          owner_child_profile_id: ownerChildId,
        })
        .eq("id", editingCharId);
      handleCancelEdit();
    } else {
      await supabase.from("characters").insert({
        family_id: familyId,
        owner_child_profile_id: ownerChildId,
        name: name.trim(),
        traits: combinedTraits,
      });
      setName("");
      setSelectedTraits([]);
      setCustomTrait("");
    }

    setIsCreating(false);
    loadData();
  };

  const handleRequestDelete = async (char: Character) => {
    // 1. Controllo pre-eliminazione consapevole: verifichiamo se il personaggio è usato in storie esistenti
    const { count } = await supabase
      .from("stories")
      .select("*", { count: "exact", head: true })
      .eq("character_id", char.id);

    const decision = evaluatePreDeleteCheck(count || 0);

    if (decision.requiresExplicitConfirmation) {
      setDeleteCandidate({ id: char.id, name: char.name, storyCount: decision.storyCount });
    } else {
      if (confirm(`Vuoi eliminare il personaggio "${char.name}"?`)) {
        await executeDelete(char.id);
      }
    }
  };

  const executeDelete = async (id: string) => {
    await supabase.from("characters").delete().eq("id", id);
    setDeleteCandidate(null);
    loadData();
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-400" />
          <span>Character Builder — Personaggi</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Crea i protagonisti delle storie AI. Combina tratti predefiniti e caratteristiche uniche.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Creazione */}
        <div className="glass-card p-6 lg:col-span-1 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-400" />
            <span>{editingCharId ? "Modifica Personaggio" : "Nuovo Personaggio"}</span>
          </h2>

          {children.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
              Devi prima creare un profilo bambino nella sezione &quot;Profili Figli&quot; per associare un personaggio.
            </div>
          ) : (
            <form onSubmit={handleAddOrEditCharacter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Bambino Proprietario
                </label>
                <select
                  value={ownerChildId}
                  onChange={(e) => setOwnerChildId(e.target.value)}
                  className="input-field"
                >
                  {children.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Nome Personaggio
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="es. Capitan Leo"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Tratti Predefiniti (clicca per scegliere)
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_TRAITS.map((trait) => {
                    const active = selectedTraits.includes(trait);
                    return (
                      <button
                        key={trait}
                        type="button"
                        onClick={() => toggleTrait(trait)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          active
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-105"
                            : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {trait}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Tratto / Dettaglio Personalizzato (opzionale)
                </label>
                <input
                  type="text"
                  value={customTrait}
                  onChange={(e) => setCustomTrait(e.target.value)}
                  placeholder="es. Ha un mantello magico blu"
                  className="input-field"
                />
              </div>

              <div className="flex gap-2 mt-4">
                <button type="submit" disabled={isCreating} className="btn-primary flex-1">
                  <Sparkles className="w-4 h-4" />
                  <span>{isCreating ? "Salvataggio..." : editingCharId ? "Salva Modifiche" : "Crea Personaggio"}</span>
                </button>
                {editingCharId && (
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
          )}
        </div>

        {/* Elenco Personaggi */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="glass-card p-8 animate-pulse text-center text-slate-400">
              Caricamento personaggi...
            </div>
          ) : characters.length === 0 ? (
            <div className="glass-card p-12 text-center text-slate-400">
              Nessun personaggio creato. Aggiungi il primo personaggio usando il form a sinistra.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {characters.map((char) => {
                const owner = children.find((c) => c.id === char.owner_child_profile_id);
                return (
                  <div key={char.id} className="glass-card p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="badge-glow text-[10px]">
                          {owner ? owner.name : "Famiglia"}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(char)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                            title="Modifica personaggio"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRequestDelete(char)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Elimina personaggio"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-bold text-lg text-white mb-1">{char.name}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">{char.traits}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modale di conferma consapevole pre-eliminazione per entità in uso */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="max-w-md w-full glass-card p-6 border-amber-500/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <span>Attenzione: Personaggio in Uso</span>
              </div>
              <button
                onClick={() => setDeleteCandidate(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Il personaggio <strong className="text-white">&quot;{deleteCandidate.name}&quot;</strong> è
              attualmente associato a <strong className="text-amber-300">{deleteCandidate.storyCount} storie AI generate</strong>.
              Se lo elimini, le storie rimarranno archiviate ma il riferimento al personaggio verrà rimosso.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="btn-secondary text-xs !py-2"
              >
                Annulla
              </button>
              <button
                onClick={() => executeDelete(deleteCandidate.id)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
              >
                Conferma ed Elimina Personaggio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
