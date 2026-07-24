"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Library, Plus, Trash2, AlertTriangle, X, Sparkles, Edit2, Compass } from "lucide-react";
import { evaluatePreDeleteCheck } from "@/lib/library/delete-helper";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { useViewedPresets } from "@/hooks/useViewedPresets";
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

interface NarrativeContent {
  id: string;
  name: string;
  description: string;
  icon_preset: string;
  isUnlocked: boolean;
  price_cents: number;
  created_at?: string;
}

interface ChildProfile {
  id: string;
  name: string;
}

interface Setting {
  id: string;
  name: string;
  description: string;
  owner_child_profile_id: string;
  created_at: string;
}

const PRESET_SETTINGS = [
  {
    name: "Bosco Incantato delle Fate",
    description: "Un bosco magico dove gli alberi sussurrano dolci melodie e lucine luminose illuminano i sentieri.",
  },
  {
    name: "Stazione Spaziale Alfa",
    description: "Una futuristica base orbitante tra stelle scintillanti e pianeti colorati da esplorare.",
  },
  {
    name: "Castello Sospeso sulle Nuvole",
    description: "Un magnifico castello di cristallo che galleggia morbidamente su soffici nuvole rosa.",
  },
  {
    name: "Isola dei Tesori Nascosti",
    description: "Un'isola tropicale con spiagge dorate, caverne misteriose e mappe antiche da decifrare.",
  },
  {
    name: "Regno Sottomarino dei Coralli",
    description: "Una meravigliosa città sommersa abitata da pesci variopinti, delfini saggi e conchiglie luminose.",
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Form Creazione / Modifica
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSettingId, setEditingSettingId] = useState<string | null>(null);
  const [ownerChildId, setOwnerChildId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [unlockedThemes, setUnlockedThemes] = useState<NarrativeContent[]>([]);

  // Modale di conferma eliminazione per entità usate in storie
  const [deleteCandidate, setDeleteCandidate] = useState<{
    id: string;
    name: string;
    storyCount: number;
  } | null>(null);

  const { isNew, markAsViewed } = useViewedPresets();
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

    const { data: setData } = await supabase
      .from("settings")
      .select("*")
      .order("created_at", { ascending: false });
    setSettings(setData || []);

    try {
      const res = await fetch("/api/family/unlocked-content");
      if (res.ok) {
        const contentData = await res.json();
        setUnlockedThemes(contentData.settingThemes || []);
      }
    } catch {
      // ignora errori fetch contenuti narrativi
    }

    setLoading(false);
  }

  const applyPreset = (preset: { name: string; description: string }) => {
    setName(preset.name);
    setDescription(preset.description);
  };

  const handleStartCreate = () => {
    handleCancelEdit();
    setIsFormOpen(true);
  };

  const handleStartEdit = (item: Setting) => {
    setEditingSettingId(item.id);
    setName(item.name);
    setDescription(item.description);
    setOwnerChildId(item.owner_child_profile_id);
    setIsFormOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingSettingId(null);
    setName("");
    setDescription("");
    setIsFormOpen(false);
  };

  const handleAddOrEditSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !ownerChildId || !familyId) return;

    setIsCreating(true);

    if (editingSettingId) {
      await supabase
        .from("settings")
        .update({
          name: name.trim(),
          description: description.trim(),
          owner_child_profile_id: ownerChildId,
        })
        .eq("id", editingSettingId);
      handleCancelEdit();
    } else {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Impossibile creare l'ambientazione.");
        setIsCreating(false);
        return;
      }
      setName("");
      setDescription("");
    }
    setIsCreating(false);
    setIsFormOpen(false);
    loadData();
  };

  const handleRequestDelete = async (item: Setting) => {
    // Controllo pre-eliminazione consapevole: verifichiamo se l'ambientazione è usata in storie
    const { count } = await supabase
      .from("stories")
      .select("*", { count: "exact", head: true })
      .eq("setting_id", item.id);

    const decision = evaluatePreDeleteCheck(count || 0);

    if (decision.requiresExplicitConfirmation) {
      setDeleteCandidate({ id: item.id, name: item.name, storyCount: decision.storyCount });
    } else {
      setDeleteCandidate({ id: item.id, name: item.name, storyCount: 0 });
    }
  };

  const executeDelete = async (id: string) => {
    await supabase.from("settings").delete().eq("id", id);
    setDeleteCandidate(null);
    loadData();
  };

  return (
    <div className="space-y-10">
      <div>
        <button
          onClick={() => router.back()}
          className="text-xs font-semibold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 mb-3"
        >
          ← Torna indietro
        </button>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Library className="w-6 h-6 text-pink-400" />
              <span>Setting Builder — Ambientazioni</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Crea i mondi magici e le cornici in cui prendere vita le avventure AI per i tuoi bambini.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStartCreate}
            className="btn-primary text-xs !py-2.5 !px-4 flex items-center justify-center gap-2 shrink-0 shadow-md shadow-pink-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuova Ambientazione</span>
          </button>
        </div>
      </div>

      {/* Elenco Ambientazioni */}
      {loading ? (
        <div className="glass-card p-8 animate-pulse text-center text-slate-400">
          Caricamento ambientazioni...
        </div>
      ) : settings.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-400 border-dashed space-y-4">
          <p>Nessuna ambientazione creata. Clicca su &quot;+ Nuova Ambientazione&quot; per iniziare.</p>
          <button type="button" onClick={handleStartCreate} className="btn-secondary text-xs">
            <Plus className="w-4 h-4 mr-1 inline" /> Crea Prima Ambientazione
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {settings.map((item) => {
            const owner = children.find((c) => c.id === item.owner_child_profile_id);
            return (
              <div key={item.id} className="glass-card p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="badge-glow text-[10px]">
                      {owner ? owner.name : "Famiglia"}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                        title="Modifica ambientazione"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRequestDelete(item)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Elimina ambientazione"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-bold text-lg text-white mb-1">{item.name}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog/Sheet per Aggiungere o Modificare Ambientazione */}
      <ResponsiveModal
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) handleCancelEdit();
          setIsFormOpen(open);
        }}
        title={editingSettingId ? "Modifica Ambientazione" : "Nuova Ambientazione"}
        description="Le ambientazioni possono essere usate come sfondo per le storie AI generate."
        footer={
          children.length > 0 ? (
            <>
              <button 
              type="button" 
              disabled={isCreating} 
              onClick={() => {
                const form = document.getElementById("setting-form") as HTMLFormElement;
                form?.requestSubmit();
              }}
              className="btn-primary flex-1"
            >
              <Compass className="w-4 h-4" />
              <span>{isCreating ? "Salvataggio..." : editingSettingId ? "Salva Modifiche" : "Crea Ambientazione"}</span>
            </button>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="btn-secondary px-4 text-xs"
              >
                Annulla
              </button>
            </>
          ) : null
        }
      >
        <div className="pb-4">
          {children.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
              Devi prima creare un profilo bambino nella sezione &quot;Profili Figli&quot; per associare un'ambientazione.
            </div>
          ) : (
            <form id="setting-form" onSubmit={handleAddOrEditSetting} className="space-y-4">
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

            {unlockedThemes.filter((t) => t.isUnlocked).length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
                  🔓 Ambientazioni Speciali Sbloccate
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-1">
                  {unlockedThemes
                    .filter((t) => t.isUnlocked)
                    .map((theme) => {
                      const isCurrentlyNew = isNew(theme.id, (theme as any).created_at || "");
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => {
                            applyPreset({ name: theme.name, description: theme.description });
                            markAsViewed(theme.id);
                          }}
                          className="px-3 py-1.5 rounded-xl text-left text-xs font-medium bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 transition-all flex flex-col gap-1 relative overflow-hidden"
                        >
                          <span className="font-bold flex items-center gap-1.5">
                            {theme.name}
                            {isCurrentlyNew && (
                              <span className="bg-rose-500 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full animate-pulse">
                                Nuovo!
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-amber-400/70 line-clamp-2">
                            {theme.description}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {unlockedThemes.filter((t) => !t.isUnlocked).length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-700">
                <Link
                  href="/billing"
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <span>✨</span>
                  <span>
                    + {unlockedThemes.filter((t) => !t.isUnlocked).length} ambientazioni magiche disponibili nel{" "}
                    <span className="underline underline-offset-2">Negozio Narrativo</span>
                  </span>
                </Link>
                <div className="mt-2 space-y-1.5">
                    {unlockedThemes
                    .filter((t) => !t.isUnlocked)
                    .map((theme) => {
                      const isCurrentlyNew = isNew(theme.id, (theme as any).created_at || "");
                      return (
                        <div
                          key={theme.id}
                          className="px-3 py-1.5 rounded-xl text-left text-xs font-medium bg-slate-800/80 border border-slate-700 text-slate-500 flex flex-col gap-1 relative overflow-hidden cursor-not-allowed"
                        >
                          <span className="font-bold flex items-center gap-1.5">
                            🔒 {theme.name}
                            {isCurrentlyNew && (
                              <span className="bg-rose-500 text-white text-[8px] font-bold uppercase px-1 py-0.5 rounded-full">
                                Nuovo!
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-600 line-clamp-2">
                            {theme.description}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Ispirati a un Preset Gratuito (clicca per applicare)
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto p-1">
                {PRESET_SETTINGS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="w-full text-left p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 transition-colors text-xs"
                  >
                    <strong className="text-pink-300 block">{preset.name}</strong>
                    <span className="text-slate-400 line-clamp-1">{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Nome Ambientazione
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Foresta Magica Incantata"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Descrizione Dettagliata
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrivi i colori, i suoni e l'atmosfera di questo luogo magico..."
                className="input-field"
              />
            </div>

            </form>
          )}
        </div>
      </ResponsiveModal>

      <AlertDialog open={Boolean(deleteCandidate)} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              <span>
                {deleteCandidate?.storyCount && deleteCandidate.storyCount > 0
                  ? "Attenzione: Ambientazione in Uso"
                  : "Conferma Eliminazione"}
              </span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate?.storyCount && deleteCandidate.storyCount > 0 ? (
                <>
                  L&apos;ambientazione <strong className="text-white">&quot;{deleteCandidate.name}&quot;</strong> è
                  attualmente associata a <strong className="text-amber-300">{deleteCandidate.storyCount} storie AI generate</strong>.
                  Se procedi all&apos;eliminazione, le storie resteranno archiviate ma il riferimento a questa ambientazione verrà rimosso.
                </>
              ) : (
                <>
                  Sei sicuro di voler eliminare l&apos;ambientazione <strong className="text-white">&quot;{deleteCandidate?.name}&quot;</strong> dalla tua libreria?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCandidate && executeDelete(deleteCandidate.id)}
              className="bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500"
            >
              Conferma ed Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
