"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  Sparkles,
  Plus,
  Library,
  Users,
  ArrowRight,
} from "lucide-react";
import ContentReportModal from "@/components/stories/ContentReportModal";
import StoriesFilterBar, {
  type StoryFilterState,
} from "@/components/stories/StoriesFilterBar";
import StoryCardUnified, {
  type UnifiedStory,
  type ChildProfileOption,
} from "@/components/stories/StoryCardUnified";
import { filterStories } from "@/lib/stories-filter";

export default function StoriesArchivePage() {
  const [stories, setStories] = useState<UnifiedStory[]>([]);
  const [children, setChildren] = useState<ChildProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [storyToDelete, setStoryToDelete] = useState<UnifiedStory | null>(null);
  const [storyToReport, setStoryToReport] = useState<UnifiedStory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  const [filters, setFilters] = useState<StoryFilterState>({
    searchQuery: "",
    sourceFilter: "all",
    ageFilter: "all",
    childFilter: "all",
    statusFilter: "all",
  });

  const supabase = createClient();

  useEffect(() => {
    loadArchive();
  }, []);

  async function loadArchive() {
    setLoading(true);
    const { data: childData } = await supabase
      .from("child_profiles")
      .select("id, name");
    setChildren(childData || []);

    // 1. Query relazionale: recuperiamo le storie (AI della famiglia + Preset globali)
    // assieme alle righe di story_assignments in un'unica chiamata ottimizzata.
    const { data: storyData } = await supabase
      .from("stories")
      .select("*, story_assignments(*)")
      .order("created_at", { ascending: false });

    if (storyData) {
      const mapped: UnifiedStory[] = storyData.map((st: any) => ({
        ...st,
        assignments: st.story_assignments || st.assignments || [],
      }));
      setStories(mapped);
    } else {
      // Fallback: se la join diretta non va (es. in ambienti mock limitati), facciamo due query separatamente
      const { data: simpleStories } = await supabase
        .from("stories")
        .select("*")
        .order("created_at", { ascending: false });

      if (simpleStories) {
        const enriched = await Promise.all(
          simpleStories.map(async (st) => {
            const { data: assData } = await supabase
              .from("story_assignments")
              .select("*")
              .eq("story_id", st.id);
            return {
              ...st,
              assignments: assData || [],
            };
          })
        );
        setStories(enriched);
      }
    }
    setLoading(false);
  }

  // Filtraggio puro in tempo reale con useMemo
  const filteredStories = useMemo(() => {
    return filterStories(stories, filters);
  }, [stories, filters]);

  const handleDeleteStory = (st: UnifiedStory) => {
    if (st.source === "preset") return; // Sicurezza supplementare
    setStoryToDelete(st);
  };

  async function handleGenerateOrDownloadPDF(st: UnifiedStory) {
    setLoadingPdfId(st.id);
    try {
      const res = await fetch(`/api/stories/${st.id}/pdf/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(
          `Errore PDF: ${data.error || "Impossibile generare/ottenere il PDF"}`
        );
        return;
      }
      if (data.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        if (data.storagePath && !st.pdf_storage_path) {
          setStories((prev) =>
            prev.map((item) =>
              item.id === st.id
                ? { ...item, pdf_storage_path: data.storagePath }
                : item
            )
          );
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore di connessione";
      alert(`Errore di connessione al server: ${msg}`);
    } finally {
      setLoadingPdfId(null);
    }
  }

  const confirmDeleteStory = async () => {
    if (!storyToDelete || storyToDelete.source === "preset") return;
    setDeleting(true);
    await supabase.from("stories").delete().eq("id", storyToDelete.id);
    setDeleting(false);
    setStoryToDelete(null);
    loadArchive();
  };

  const toggleAssignment = async (
    e: React.MouseEvent,
    storyId: string,
    childId: string
  ) => {
    e.preventDefault();
    const st = stories.find((s) => s.id === storyId);
    if (!st) return;

    const existing = st.assignments?.find(
      (a) => a.child_profile_id === childId
    );

    // Aggiornamento Ottimistico UI
    setStories((prev) =>
      prev.map((item) => {
        if (item.id !== storyId) return item;
        const currentAssigns = item.assignments || [];
        if (existing) {
          return {
            ...item,
            assignments: currentAssigns.filter((a) => a.id !== existing.id),
          };
        } else {
          return {
            ...item,
            assignments: [
              ...currentAssigns,
              {
                id: `temp-${Date.now()}`,
                child_profile_id: childId,
                reading_status: "new",
                last_read_position: 0,
              },
            ],
          };
        }
      })
    );

    if (existing) {
      await supabase.from("story_assignments").delete().eq("id", existing.id);
    } else {
      await supabase.from("story_assignments").insert({
        story_id: storyId,
        child_profile_id: childId,
        reading_status: "new",
        last_read_position: 0,
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Intestazione Principale e Pulsante Generazione */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 mb-2"
          >
            ← Torna alla Dashboard Genitore
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2.5 text-white">
            <BookOpen className="w-7 h-7 text-indigo-400" />
            <span>Le Mie Storie (Archivio & Preset)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Libreria unificata di consultazione e assegnazione. Consulta le favole generate dalla tua famiglia o sfoglia le storie predefinite del sistema per le letture serali dei tuoi figli.
          </p>
        </div>

        <Link
          href="/stories/new"
          className="btn-primary text-xs flex items-center gap-2 self-start md:self-center shrink-0 shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Nuova Storia AI</span>
        </Link>
      </div>

      {/* Banner di Separazione Chiarificatore: Consultazione vs Creazione */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 bg-gradient-to-br from-indigo-950/50 via-slate-900 to-slate-900 border-indigo-500/40 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-bold text-[10px] uppercase tracking-wider mb-2">
              <span>Sei qui</span>
            </div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>Libreria di Consultazione</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              <strong>Le Mie Storie</strong> raccoglie tutti i racconti completi pronti per essere letti dai bambini nella Modalità Lettura.
            </p>
          </div>
        </div>

        <Link
          href="/library/characters"
          className="glass-card p-5 border-slate-800/80 hover:border-purple-500/50 transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-bold text-[10px] uppercase tracking-wider mb-2">
              <span>Libreria di Creazione</span>
            </div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2 group-hover:text-purple-300 transition-colors">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Laboratorio Personaggi</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Crea o personalizza gli eroi e i loro tratti prima di inventare una nuova favola AI.
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-semibold text-purple-400">
            <span>Vai ai Personaggi</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/library/settings"
          className="glass-card p-5 border-slate-800/80 hover:border-pink-500/50 transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-500/15 text-pink-300 font-bold text-[10px] uppercase tracking-wider mb-2">
              <span>Libreria di Creazione</span>
            </div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2 group-hover:text-pink-300 transition-colors">
              <Library className="w-4 h-4 text-pink-400" />
              <span>Mondi & Ambientazioni</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Scegli o inventa luoghi incantati dove far svolgere le prossime avventure.
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-semibold text-pink-400">
            <span>Vai alle Ambientazioni</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Barra di Filtraggio Unificata */}
      <StoriesFilterBar
        filters={filters}
        onFilterChange={setFilters}
        childrenOptions={children}
        totalCount={stories.length}
        filteredCount={filteredStories.length}
      />

      {/* Elenco Storie Filtrate */}
      {loading ? (
        <div className="glass-card p-12 text-center text-slate-400 animate-pulse">
          Caricamento delle favole e delle assegnazioni in corso...
        </div>
      ) : filteredStories.length === 0 ? (
        <div className="glass-card p-16 text-center space-y-4 max-w-lg mx-auto">
          <Sparkles className="w-12 h-12 text-indigo-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">
            Nessuna Storia Trovata per i Filtri Attuali
          </h2>
          <p className="text-xs text-slate-400">
            {stories.length === 0
              ? "Inizia creando la prima favola su misura per i tuoi bambini usando il Generatore AI."
              : "Prova a reimpostare o modificare i filtri di ricerca, età o stato di lettura."}
          </p>
          {stories.length === 0 ? (
            <Link href="/stories/new" className="btn-primary inline-flex text-xs">
              Genera Prima Storia
            </Link>
          ) : (
            <button
              onClick={() =>
                setFilters({
                  searchQuery: "",
                  sourceFilter: "all",
                  ageFilter: "all",
                  childFilter: "all",
                  statusFilter: "all",
                })
              }
              className="btn-secondary inline-flex text-xs"
            >
              Reimposta tutti i filtri
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredStories.map((st) => (
            <StoryCardUnified
              key={st.id}
              story={st}
              childrenProfiles={children}
              onToggleAssignment={toggleAssignment}
              onGenerateOrDownloadPdf={handleGenerateOrDownloadPDF}
              onReportStory={(story) => setStoryToReport(story)}
              onDeleteStory={handleDeleteStory}
              loadingPdfId={loadingPdfId}
            />
          ))}
        </div>
      )}

      {/* Modale di Conferma Eliminazione (solo per storie generate, mai preset) */}
      {storyToDelete && storyToDelete.source !== "preset" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card p-6 border-slate-800 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Elimina Storia</h3>
            </div>
            <p className="text-sm text-slate-300">
              Sei sicuro di voler eliminare definitivamente questa storia generata? 
              L&apos;azione rimuoverà anche i progressi di lettura e i PDF associati.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setStoryToDelete(null)}
                disabled={deleting}
                className="btn-secondary text-xs"
              >
                Annulla
              </button>
              <button
                onClick={confirmDeleteStory}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-2"
              >
                {deleting && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Elimina Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Segnalazione Contenuto Problematico */}
      <ContentReportModal
        isOpen={!!storyToReport}
        onClose={() => setStoryToReport(null)}
        storyId={storyToReport?.id || null}
        storyTitle={
          storyToReport
            ? storyToReport.generated_text.split("\n")[0]?.replace(/^#\s*/, "") ||
              "Storia"
            : ""
        }
      />
    </div>
  );
}
