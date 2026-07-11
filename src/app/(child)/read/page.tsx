"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  Lock,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  AlertTriangle,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { paginateText } from "@/lib/reader/paginator";

interface ChildProfile {
  id: string;
  name: string;
  birth_year?: number;
  avatar_preset_id?: string;
}

interface ReadableStory {
  assignmentId?: string;
  id: string;
  title: string;
  generated_text: string;
  target_age_range: string;
  reading_status: "new" | "in_progress" | "completed";
  last_read_position: number;
  created_at: string;
}

export default function ChildReaderPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const [stories, setStories] = useState<ReadableStory[]>([]);
  const [activeStory, setActiveStory] = useState<ReadableStory | null>(null);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const storyPages = useMemo(() => {
    return activeStory ? paginateText(activeStory.generated_text, 450) : [];
  }, [activeStory]);

  // Modale PIN Uscita
  const [showExitModal, setShowExitModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const supabase = createClient();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      loadStoriesForChild(selectedChildId);
    }
  }, [selectedChildId]);

  async function loadInitialData() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const activeChildId = user?.app_metadata?.active_child_profile_id;

    // 1. Carica i profili bambino disponibili
    const { data: childList } = await supabase
      .from("child_profiles")
      .select("id, name, birth_year, avatar_preset_id")
      .order("created_at", { ascending: true });

    if (childList && childList.length > 0) {
      setChildren(childList);
      const targetChildId =
        activeChildId && childList.some((c) => c.id === activeChildId)
          ? activeChildId
          : childList[0].id;
      setSelectedChildId(targetChildId);
    } else {
      // Se non ci sono profili, carica comunque le storie generali
      await loadStoriesForChild(null);
    }
    setLoading(false);
  }

  async function loadStoriesForChild(childId: string | null) {
    setLoading(true);

    // Carica tutte le storie della famiglia
    const { data: allStories } = await supabase
      .from("stories")
      .select("id, generated_text, target_age_range, created_at")
      .order("created_at", { ascending: false });

    // Carica le assegnazioni specifiche se c'è un bambino selezionato
    let assignmentMap = new Map<
      string,
      { id: string; status: "new" | "in_progress" | "completed"; position: number }
    >();

    if (childId) {
      const { data: assignData } = await supabase
        .from("story_assignments")
        .select("id, story_id, reading_status, last_read_position")
        .eq("child_profile_id", childId);

      if (assignData) {
        assignData.forEach((a) => {
          assignmentMap.set(a.story_id, {
            id: a.id,
            status: a.reading_status as "new" | "in_progress" | "completed",
            position: a.last_read_position,
          });
        });
      }
    }

    if (allStories) {
      const formatted: ReadableStory[] = allStories.map((s) => {
        const lines = s.generated_text.split("\n");
        const titleLine = lines[0]?.replace(/^#\s*/, "") || "Favola Incantata";
        const assignment = assignmentMap.get(s.id);

        return {
          id: s.id,
          assignmentId: assignment?.id,
          title: titleLine,
          generated_text: s.generated_text,
          target_age_range: s.target_age_range,
          reading_status: assignment ? assignment.status : "new",
          last_read_position: assignment ? assignment.position : 0,
          created_at: s.created_at,
        };
      });

      setStories(formatted);
    }
    setLoading(false);
  }

  const handleSelectChild = async (childId: string) => {
    setSelectedChildId(childId);
    setActiveStory(null);

    try {
      await fetch("/api/child-mode/select-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childProfileId: childId }),
      });
      await supabase.auth.refreshSession();
    } catch {
      // Continua comunque in modalità lettura client
    }
  };

  const handleOpenStory = async (item: ReadableStory) => {
    setActiveStory(item);
    setCurrentPageIdx(0);
    if (item.assignmentId && item.reading_status === "new") {
      updateProgress(item.assignmentId, 0, "in_progress");
    }
  };

  const handlePageChange = (newIdx: number) => {
    if (newIdx < 0 || newIdx >= storyPages.length) return;
    setCurrentPageIdx(newIdx);

    if (activeStory?.assignmentId && storyPages.length > 0) {
      const percentage = Math.round(((newIdx + 1) / storyPages.length) * 100);
      const isLastPage = newIdx === storyPages.length - 1;
      updateProgress(
        activeStory.assignmentId,
        percentage,
        isLastPage ? "completed" : "in_progress"
      );
    }
  };

  const updateProgress = async (
    assignmentId: string | undefined,
    position: number,
    status: "new" | "in_progress" | "completed"
  ) => {
    if (!assignmentId) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      await supabase
        .from("story_assignments")
        .update({
          last_read_position: position,
          reading_status: status,
        })
        .eq("id", assignmentId);
    }, 400);
  };

  const handleScrollProgress = (e: React.UIEvent<HTMLDivElement>) => {
    if (!activeStory || !activeStory.assignmentId) return;
    const target = e.currentTarget;
    const scrollPercentage = Math.round(
      (target.scrollTop / (target.scrollHeight - target.clientHeight || 1)) * 100
    );

    const newStatus = scrollPercentage >= 95 ? "completed" : "in_progress";
    updateProgress(activeStory.assignmentId, scrollPercentage, newStatus);
  };

  const handleVerifyPinAndExit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setIsVerifyingPin(true);

    try {
      const res = await fetch("/api/child-mode/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "PIN errato");
      }

      await supabase.auth.refreshSession();
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      setPinError(err instanceof Error ? err.message : "Errore PIN");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 space-y-8">
      {/* Intestazione Bambino & Selettore Profilo */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 glass-card p-5 border-emerald-500/30">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-2xl shadow-lg">
            S
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Libreria Magica</h1>
            <p className="text-xs text-emerald-300">
              Scegli chi sta leggendo ed esplora le tue favole
            </p>
          </div>
        </div>

        {/* Selettore Bambini */}
        {children.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1">
            {children.map((child) => {
              const isActive = selectedChildId === child.id;
              return (
                <button
                  key={child.id}
                  onClick={() => handleSelectChild(child.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 scale-105"
                      : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>{child.name}</span>
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={() => setShowExitModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors shrink-0"
        >
          <Lock className="w-4 h-4 text-amber-400" />
          <span>Esci al Genitore</span>
        </button>
      </div>

      {/* Reader Storia Attiva o Elenco */}
      {/* Reader Storia Attiva (Paginata) o Elenco */}
      {activeStory ? (
        <div className="glass-card p-6 md:p-12 border-emerald-500/40 space-y-8 max-w-4xl mx-auto">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <button
              onClick={() => setActiveStory(null)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Torna all&apos;elenco storie</span>
            </button>
            <div className="flex items-center gap-3">
              <span className="badge-glow text-xs">
                Età {activeStory.target_age_range}
              </span>
              <span className="text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
                Pagina {currentPageIdx + 1} di {storyPages.length || 1}
              </span>
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-emerald-300">
            {activeStory.title}
          </h2>

          {/* Testo pagina corrente */}
          <div className="min-h-[300px] p-6 md:p-10 rounded-3xl bg-slate-900/90 border border-slate-800 text-slate-100 text-lg md:text-xl leading-relaxed whitespace-pre-line flex flex-col justify-center">
            {storyPages.length > 0 ? storyPages[currentPageIdx] : activeStory.generated_text}
          </div>

          {/* Barra di avanzamento e navigazione pagine */}
          <div className="space-y-4 pt-2">
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                style={{
                  width: `${((currentPageIdx + 1) / (storyPages.length || 1)) * 100}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => handlePageChange(currentPageIdx - 1)}
                disabled={currentPageIdx === 0}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${
                  currentPageIdx === 0
                    ? "bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800/60"
                    : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-md"
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Precedente</span>
              </button>

              {currentPageIdx === storyPages.length - 1 ? (
                <button
                  onClick={() => {
                    updateProgress(activeStory.assignmentId, 100, "completed");
                    setActiveStory(null);
                    loadStoriesForChild(selectedChildId);
                  }}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-sm shadow-lg shadow-emerald-500/30 transition-all scale-105"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Completa e Segna come Letta ✓</span>
                </button>
              ) : (
                <button
                  onClick={() => handlePageChange(currentPageIdx + 1)}
                  disabled={currentPageIdx >= storyPages.length - 1}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-all"
                >
                  <span>Successiva</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="glass-card p-12 text-center text-slate-400 animate-pulse">
          Caricamento storie magiche in corso...
        </div>
      ) : stories.length === 0 ? (
        <div className="glass-card p-16 text-center space-y-4 max-w-xl mx-auto">
          <Sparkles className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">
            Nessuna Storia Ancora Generata
          </h2>
          <p className="text-sm text-slate-400">
            Chiedi al genitore di creare una nuova favola magica con l&apos;AI dalla Dashboard.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stories.map((item) => (
            <div
              key={item.id}
              onClick={() => handleOpenStory(item)}
              className="glass-card p-6 cursor-pointer hover:border-emerald-500/60 transition-all transform hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="badge-glow text-[10px]">
                    Età {item.target_age_range}
                  </span>
                  {item.reading_status === "completed" ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
                      <CheckCircle2 className="w-4 h-4" /> Letta
                    </span>
                  ) : item.reading_status === "in_progress" ? (
                    <span className="text-xs text-amber-400 font-bold">
                      In Lettura
                    </span>
                  ) : (
                    <span className="text-xs text-pink-400 font-bold">
                      Nuova ★
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-lg text-white mb-2 line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-4 leading-relaxed">
                  {item.generated_text}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-emerald-300">
                <span>Inizia a Leggere</span>
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modale PIN Uscita al Genitore */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full glass-card p-6 border-amber-500/40 space-y-6">
            <div className="flex items-center gap-3 text-amber-400 font-bold text-lg">
              <Lock className="w-6 h-6" />
              <span>Inserisci PIN Genitore per Uscire</span>
            </div>

            <p className="text-xs text-slate-300">
              Digita il tuo PIN da 4-6 cifre per sbloccare la modalità genitore ed uscire dall&apos;area bambino.
            </p>

            {pinError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyPinAndExit} className="space-y-4">
              <input
                type="password"
                required
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                className="input-field text-center text-xl tracking-widest font-mono"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowExitModal(false);
                    setPinError(null);
                  }}
                  className="btn-secondary text-xs"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPin}
                  className="btn-primary text-xs !py-2.5"
                >
                  {isVerifyingPin ? "Verifica..." : "Sblocca ed Esci"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
