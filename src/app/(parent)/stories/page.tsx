"use client";

import React, { useEffect, useState } from "react";
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
  target_age_range: string;
  generated_text: string;
  created_at: string;
  assignments?: StoryAssignment[];
}

export default function StoriesArchivePage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDeleteStory = async (id: string) => {
    if (confirm("Vuoi eliminare definitivamente questa storia dall'archivio?")) {
      await supabase.from("stories").delete().eq("id", id);
      loadArchive();
    }
  };

  const toggleAssignment = async (storyId: string, childId: string) => {
    const st = stories.find((s) => s.id === storyId);
    if (!st) return;

    const existing = st.assignments?.find(
      (a) => a.child_profile_id === childId
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
    loadArchive();
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
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

                  <button
                    onClick={() => handleDeleteStory(st.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors self-start md:self-center"
                    title="Elimina storia"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed line-clamp-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                  {st.generated_text}
                </div>

                {/* Assegnazioni e Stato di Lettura dei Bambini */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    Assegnata a:
                  </span>

                  {children.length === 0 ? (
                    <span className="text-xs text-amber-400/80 italic">
                      Nessun profilo bambino presente. Crea prima un profilo nella sezione &quot;Profili Figli&quot;.
                    </span>
                  ) : (
                    children.map((child) => {
                      const assignment = st.assignments?.find(
                        (a) => a.child_profile_id === child.id
                      );

                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => toggleAssignment(st.id, child.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                            assignment
                              ? "bg-indigo-600/20 border-indigo-500 text-indigo-200"
                              : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                          title={assignment ? "Clicca per rimuovere assegnazione" : "Clicca per assegnare la storia"}
                        >
                          <span>
                            {assignment ? "✓ " : "+ "} {child.name}
                          </span>

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
    </div>
  );
}
