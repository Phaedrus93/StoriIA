"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  Trash2,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
} from "lucide-react";

interface ChildProfile {
  id: string;
  name: string;
}

interface StoryAssignment {
  id: string;
  child_profile_id: string;
  reading_status: "new" | "in_progress" | "completed";
  last_read_position: number;
}

interface Story {
  id: string;
  source?: string;
  target_age_range: string;
  generated_text: string;
  created_at: string;
  assignments?: StoryAssignment[];
}

export default function StoriesArchivePage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [storyToDelete, setStoryToDelete] = useState<Story | null>(null);
  const [deleting, setDeleting] = useState(false);

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

    const { data: storyData } = await supabase
      .from("stories")
      .select("*")
      .order("created_at", { ascending: false });

    if (storyData) {
      // Carica assegnazioni per ciascuna storia
      const enriched = await Promise.all(
        storyData.map(async (st) => {
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
    setLoading(false);
  }

  const handleDeleteStory = (st: Story) => {
    setStoryToDelete(st);
  };

  const confirmDeleteStory = async () => {
    if (!storyToDelete) return;
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
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 mb-3"
          >
            ← Torna alla Dashboard Genitore
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            <span>Archivio Storie della Famiglia</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestisci le favole AI generate, segui lo stato di lettura dei tuoi bambini e riassegnale quando vuoi.
          </p>
        </div>

        <a
          href="/stories/new"
          className="btn-primary text-xs flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nuova Storia AI</span>
        </a>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-slate-400 animate-pulse">
          Caricamento archivio storie...
        </div>
      ) : stories.length === 0 ? (
        <div className="glass-card p-16 text-center space-y-4 max-w-lg mx-auto">
          <Sparkles className="w-12 h-12 text-indigo-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">
            Nessuna Storia nell&apos;Archivio
          </h2>
          <p className="text-xs text-slate-400">
            Inizia creando la prima favola su misura per i tuoi bambini usando il Generatore AI.
          </p>
          <a href="/stories/new" className="btn-primary inline-flex text-xs">
            Genera Prima Storia
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {stories.map((st) => {
            const firstLine =
              st.generated_text.split("\n")[0] || "Storia Senza Titolo";
            return (
              <div
                key={st.id}
                className="glass-card p-6 border-slate-800 space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge-glow text-[10px]">
                        Fascia {st.target_age_range} anni
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(st.created_at).toLocaleDateString("it-IT")}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      {firstLine.replace(/^#\s*/, "")}
                    </h3>
                  </div>

                  {st.source !== "preset" && (
                    <button
                      onClick={() => handleDeleteStory(st)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors self-start md:self-center"
                      title="Elimina storia"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-300 leading-relaxed line-clamp-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                  {st.generated_text}
                </div>

                {/* Lista Assegnazione Figli */}
                <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-800/80">
                  <span className="text-xs text-slate-400 mr-1">Assegna a:</span>
                  {children.length === 0 ? (
                    <span className="text-xs text-slate-500 italic">
                      Nessun profilo figlio configurato
                    </span>
                  ) : (
                    children.map((child) => {
                      const assignment = st.assignments?.find(
                        (a) => a.child_profile_id === child.id
                      );
                      return (
                        <button
                          key={child.id}
                          onClick={(e) => toggleAssignment(e, st.id, child.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                            assignment
                              ? "bg-indigo-600/20 border-indigo-500 text-indigo-200"
                              : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                          title={assignment ? "Clicca per rimuovere assegnazione" : "Clicca per assegnare la storia"}
                        >
                          <span>{assignment ? "✓ " : "+ "} {child.name}</span>
                          {assignment && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-900/80">
                              {assignment.reading_status === "completed" ? (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Letta
                                </span>
                              ) : assignment.reading_status === "in_progress" ? (
                                <span className="text-amber-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />{" "}
                                  {assignment.last_read_position}%
                                </span>
                              ) : (
                                <span className="text-pink-400">Nuova</span>
                              )}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {storyToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-card p-6 border-rose-500/30 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-white">Elimina Storia</h3>
            </div>
            <p className="text-sm text-slate-300">
              Vuoi eliminare definitivamente una storia dall&apos;archivio? L&apos;azione non può essere annullata.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStoryToDelete(null)}
                className="btn-secondary px-4 py-2 text-xs"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteStory}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-500/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? "Eliminazione..." : "Conferma Eliminazione"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
