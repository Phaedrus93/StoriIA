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
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
} from "lucide-react";
import { paginateText } from "@/lib/reader/paginator";
import { getAvatarUrl } from "@/lib/avatars";
import { ChildAvatarWithBadge, getCosmeticIcon } from "@/components/ChildAvatarWithBadge";
import GamificationModal from "./components/GamificationModal";
import ReadingAccessibilityModal from "./components/ReadingAccessibilityModal";

interface ChildProfile {
  id: string;
  name: string;
  birth_year?: number;
  avatar_preset_id?: string;
  night_mode?: boolean;
  brightness?: number;
  contrast?: number;
  font_size?: string;
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
  pdf_storage_path?: string | null;
}

export default function ChildReaderPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const [stories, setStories] = useState<ReadableStory[]>([]);
  const [activeStory, setActiveStory] = useState<ReadableStory | null>(null);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  // Modale PIN Uscita
  const [showExitModal, setShowExitModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Gamification: Punti Avventura, Missioni e Premi Cosmetici
  const [adventurePoints, setAdventurePoints] = useState<number>(0);
  const [quests, setQuests] = useState<any[]>([]);
  const [questProgress, setQuestProgress] = useState<any[]>([]);
  const [cosmetics, setCosmetics] = useState<any[]>([]);
  const [unlockedCosmetics, setUnlockedCosmetics] = useState<any[]>([]);
  const [showRewardsModal, setShowRewardsModal] = useState<boolean>(false);
  const [rewardToast, setRewardToast] = useState<string | null>(null);
  const [familyTier, setFamilyTier] = useState<string>('free');
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);

  // Accessibilità e Comfort di Lettura
  const [readingNightMode, setReadingNightMode] = useState<boolean>(false);
  const [readingBrightness, setReadingBrightness] = useState<number>(100);
  const [readingContrast, setReadingContrast] = useState<number>(100);
  const [readingFontSize, setReadingFontSize] = useState<string>("medium");
  const [showAccessibilityModal, setShowAccessibilityModal] = useState<boolean>(false);
  const [isChildModeSession, setIsChildModeSession] = useState<boolean>(true);

  const maxCharsPerPage = useMemo(() => {
    switch (readingFontSize) {
      case "small":
        return 600;
      case "large":
        return 260;
      case "xlarge":
        return 140; // ~20-25 parole per pagina per evitare qualsiasi scrollbar o overflow con testo gigante A++
      default:
        return 420; // medium
    }
  }, [readingFontSize]);

  const storyPages = useMemo(() => {
    if (!activeStory) return [];
    // Rimuoviamo l'eventuale riga del titolo # Titolo prima di paginare
    const cleanBody = activeStory.generated_text
      .replace(/^#+\s*[^\r\n]+(\r?\n)*/, "")
      .trim();
    return paginateText(cleanBody || activeStory.generated_text, maxCharsPerPage);
  }, [activeStory, maxCharsPerPage]);

  useEffect(() => {
    if (storyPages.length > 0 && currentPageIdx >= storyPages.length) {
      setCurrentPageIdx(storyPages.length - 1);
    }
  }, [storyPages, currentPageIdx]);

  const supabase = createClient();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      loadStoriesForChild(selectedChildId);
      loadGamification(selectedChildId);
      const found = children.find((c) => c.id === selectedChildId);
      if (found) {
        setReadingNightMode(found.night_mode ?? false);
        setReadingBrightness(found.brightness ?? 100);
        setReadingContrast(found.contrast ?? 100);
        setReadingFontSize(found.font_size || "medium");
      }
    }
  }, [selectedChildId, children]);

  async function loadGamification(childId: string) {
    try {
      const res = await fetch(`/api/child/gamification?childId=${childId}`);
      if (res.ok) {
        const data = await res.json();
        setAdventurePoints(data.child?.adventure_points || 0);
        setQuests(data.quests || []);
        setQuestProgress(data.progress || []);
        setCosmetics(data.cosmetics || []);
        setUnlockedCosmetics(data.unlocked || []);
        setFamilyTier(data.familyTier || 'free');
        setActiveBadgeId(data.child?.active_badge_id || null);
        setActiveFrameId(data.child?.active_frame_id || null);
      }
    } catch {
      // ignora errore caricamento gamification
    }
  }

  const handleUnlockCosmetic = async (cosmeticId: string) => {
    if (!selectedChildId) return;
    try {
      const res = await fetch("/api/child/gamification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlock_cosmetic",
          childId: selectedChildId,
          cosmeticId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdventurePoints(data.adventurePoints);
        await loadGamification(selectedChildId);
        setRewardToast("Premio sbloccato con successo!");
        setTimeout(() => setRewardToast(null), 3000);
      } else {
        setRewardToast(data.error || "Impossibile sbloccare il premio");
        setTimeout(() => setRewardToast(null), 3000);
      }
    } catch {
      // ignora errore sblocco
    }
  };

  const handleSetActiveCosmetic = async (
    slot: 'badge' | 'frame',
    cosmeticId: string | null
  ) => {
    if (!selectedChildId) return;
    try {
      const res = await fetch('/api/child/gamification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_active_cosmetic',
          childId: selectedChildId,
          slot,
          cosmeticId,
        }),
      });
      if (res.ok) {
        if (slot === 'badge') {
          setActiveBadgeId(cosmeticId);
        } else {
          setActiveFrameId(cosmeticId);
        }
      }
    } catch {
      // ignora errore set_active_cosmetic
    }
  };

  async function handleGenerateOrDownloadPDF(st: ReadableStory) {
    setLoadingPdfId(st.id);
    try {
      const res = await fetch(`/api/stories/${st.id}/pdf/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(`Errore PDF: ${data.error || "Impossibile generare/ottenere il PDF"}`);
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
          if (activeStory?.id === st.id) {
            setActiveStory((prev) =>
              prev ? { ...prev, pdf_storage_path: data.storagePath } : prev
            );
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore di connessione";
      alert(`Errore di connessione al server: ${msg}`);
    } finally {
      setLoadingPdfId(null);
    }
  }

  async function loadInitialData() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setIsChildModeSession(user?.app_metadata?.is_child_mode === true);

    const queryChildId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("childId")
        : null;
    const storedChildId =
      typeof window !== "undefined"
        ? localStorage.getItem("storiia_active_child_id")
        : null;

    const activeChildId =
      queryChildId ||
      storedChildId ||
      user?.app_metadata?.active_child_profile_id;

    // 1. Carica i profili bambino disponibili con preferenze di accessibilità
    const { data: childList } = await supabase
      .from("child_profiles")
      .select("id, name, birth_year, avatar_preset_id, night_mode, brightness, contrast, font_size")
      .order("created_at", { ascending: true });

    if (childList && childList.length > 0) {
      setChildren(childList);
      const targetChildId =
        activeChildId && childList.some((c) => c.id === activeChildId)
          ? activeChildId
          : childList[0].id;
      if (typeof window !== "undefined") {
        localStorage.setItem("storiia_active_child_id", targetChildId);
      }
      setSelectedChildId(targetChildId);
      const targetProfile = childList.find((c) => c.id === targetChildId) || childList[0];
      setReadingNightMode(targetProfile.night_mode ?? false);
      setReadingBrightness(targetProfile.brightness ?? 100);
      setReadingContrast(targetProfile.contrast ?? 100);
      setReadingFontSize(targetProfile.font_size || "medium");
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
      .select("id, generated_text, target_age_range, created_at, pdf_storage_path")
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
          pdf_storage_path: s.pdf_storage_path,
        };
      });

      // Mostra ESCLUSIVAMENTE le storie assegnate a questo profilo bambino
      const assignedOnly = formatted.filter((s) => assignmentMap.has(s.id));
      setStories(assignedOnly);
    }
    setLoading(false);
  }

  const handleSelectChild = async (childId: string) => {
    setSelectedChildId(childId);
    setActiveStory(null);

    if (typeof window !== "undefined") {
      localStorage.setItem("storiia_active_child_id", childId);
    }

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
    const cleanBody = item.generated_text
      .replace(/^#+\s*[^\r\n]+(\r?\n)*/, "")
      .trim();
    const pages = paginateText(cleanBody || item.generated_text, maxCharsPerPage);
    let startIdx = 0;
    if (item.last_read_position > 0 && pages.length > 0) {
      startIdx = Math.min(pages.length - 1, item.last_read_position);
    }
    setCurrentPageIdx(startIdx);
    if (item.assignmentId && item.reading_status === "new") {
      updateProgress(item.assignmentId, startIdx, "in_progress");
    }
  };

  const handlePageChange = (newIdx: number) => {
    if (newIdx < 0 || newIdx >= storyPages.length) return;
    setCurrentPageIdx(newIdx);

    const isLastPage = newIdx === storyPages.length - 1;
    const newStatus = isLastPage ? "completed" : "in_progress";

    if (activeStory) {
      setActiveStory((prev) =>
        prev
          ? {
              ...prev,
              last_read_position: newIdx,
              reading_status: newStatus,
            }
          : null
      );
      setStories((prev) =>
        prev.map((s) =>
          s.id === activeStory.id
            ? {
                ...s,
                last_read_position: newIdx,
                reading_status: newStatus,
              }
            : s
        )
      );

      if (activeStory.assignmentId) {
        updateProgress(activeStory.assignmentId, newIdx, newStatus);
      }
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

      if (status === "completed" && selectedChildId) {
        try {
          const gamRes = await fetch("/api/child/gamification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "award_reading_points",
              childId: selectedChildId,
              storyId: activeStory?.id,
              assignmentId: activeStory?.assignmentId,
            }),
          });
          const gamData = await gamRes.json();
          if (gamData.success && typeof gamData.adventurePoints === "number") {
            setAdventurePoints(gamData.adventurePoints);
          }
        } catch {
          // ignora errori di rete sul premio
        }
      }
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

  const renderStoryCard = (item: ReadableStory) => (
    <div
      key={item.id}
      onClick={() => handleOpenStory(item)}
      className="glass-card p-6 cursor-pointer hover:border-emerald-500/60 transition-all transform hover:-translate-y-1 flex flex-col justify-between relative"
    >
      {/* Sigillo angolo per storie completate */}
      {item.reading_status === 'completed' && (
        <span className="absolute top-3 right-3 text-base select-none" title="Storia completata">
          {activeBadgeId ? '🏆' : '✓'}
        </span>
      )}
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
        <span>{item.reading_status === "completed" ? "Rileggi Favola" : item.reading_status === "in_progress" ? "Riprendi Lettura" : "Inizia a Leggere"}</span>
        <BookOpen className="w-4 h-4" />
      </div>
    </div>
  );

  return (
    <>
      {activeStory ? (
        <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden select-none animate-fadeIn">
          {/* Top Bar Compatta e Immersiva */}
          <div className="shrink-0 px-4 md:px-8 py-3 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between gap-4">
            <button
              onClick={() => setActiveStory(null)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs md:text-sm font-bold text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              <span>Torna indietro</span>
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="text-sm md:text-lg font-black text-emerald-300 truncate">
                {activeStory.title.replace(/^#+\s*/, "")}
              </h1>
              <span className="badge-glow text-[11px] shrink-0 hidden sm:inline-block">
                Età {activeStory.target_age_range}
              </span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setShowAccessibilityModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs md:text-sm font-bold text-indigo-300 hover:text-indigo-200 transition-all shadow-sm"
                title="Accessibilità e Comfort di Lettura"
              >
                <Eye className="w-4 h-4 text-indigo-400" />
                <span>Aspetto</span>
              </button>

              <button
                onClick={() => handleGenerateOrDownloadPDF(activeStory)}
                disabled={loadingPdfId === activeStory.id}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-bold text-emerald-300 hover:text-emerald-200 transition-all shadow-sm disabled:opacity-50"
                title={activeStory.pdf_storage_path ? "Scarica PDF favola" : "Genera PDF favola"}
              >
                {loadingPdfId === activeStory.id ? (
                  <span className="w-3.5 h-3.5 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <Download className="w-4 h-4 text-emerald-400" />
                )}
                <span className="hidden md:inline">PDF</span>
              </button>
            </div>
          </div>

          {/* Area Centrale Storia da Leggere (100% altezza disponibile, zero scrollbar) */}
          <div className="flex-1 flex flex-col justify-center items-center px-4 md:px-12 py-3 overflow-hidden relative">
            <div
              className={`w-full max-w-4xl flex-1 max-h-full rounded-3xl border flex flex-col justify-center items-center p-6 md:p-12 shadow-2xl transition-all overflow-hidden relative ${
                readingNightMode
                  ? "bg-black/95 text-amber-100 border-amber-500/30 shadow-inner"
                  : "bg-slate-900/90 text-slate-100 border-slate-800"
              }`}
              style={{
                filter: `brightness(${readingBrightness / 100}) contrast(${readingContrast / 100})`,
              }}
            >
              <div
                className={`w-full text-center overflow-hidden flex flex-col justify-center flex-1 transition-all ${
                  readingFontSize === "small"
                    ? "text-base md:text-xl leading-relaxed"
                    : readingFontSize === "large"
                    ? "text-xl md:text-3xl leading-relaxed font-semibold"
                    : readingFontSize === "xlarge"
                    ? "text-2xl sm:text-3xl md:text-4xl font-extrabold leading-normal sm:leading-relaxed tracking-wide"
                    : "text-lg md:text-2xl leading-relaxed font-medium"
                }`}
              >
                <p className="whitespace-pre-line line-clamp-[10] md:line-clamp-[12] my-auto">
                  {(() => {
                    const text =
                      storyPages.length > 0
                        ? storyPages[currentPageIdx]
                        : activeStory.generated_text;
                    if (currentPageIdx === 0 && text) {
                      return text.replace(/^#\s*[^\n]+\n*/, "").trim();
                    }
                    return text || "";
                  })()}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Bar Compatta di Navigazione Pagine */}
          <div className="shrink-0 px-4 md:px-8 py-3.5 bg-slate-900/90 border-t border-slate-800/80 backdrop-blur-md space-y-2.5">
            <div className="w-full max-w-4xl mx-auto bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                style={{
                  width: `${((currentPageIdx + 1) / (storyPages.length || 1)) * 100}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between max-w-4xl mx-auto gap-3">
              <button
                onClick={() => handlePageChange(currentPageIdx - 1)}
                disabled={currentPageIdx === 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs md:text-sm transition-all ${
                  currentPageIdx === 0
                    ? "bg-slate-900/50 text-slate-600 cursor-not-allowed border border-slate-800/40"
                    : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-md active:scale-95"
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Precedente</span>
              </button>

              <span className="text-xs md:text-sm font-extrabold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-4 py-1.5 rounded-full shrink-0">
                Pagina {currentPageIdx + 1} di {storyPages.length || 1}
              </span>

              {currentPageIdx === storyPages.length - 1 ? (
                <button
                  onClick={() => {
                    updateProgress(activeStory.assignmentId, 100, "completed");
                    setActiveStory(null);
                    loadStoriesForChild(selectedChildId);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-xs md:text-sm shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
                  <span>Completa Favola ✓</span>
                </button>
              ) : (
                <button
                  onClick={() => handlePageChange(currentPageIdx + 1)}
                  disabled={currentPageIdx >= storyPages.length - 1}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs md:text-sm shadow-md transition-all active:scale-95"
                >
                  <span>Successiva</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 space-y-8">
          {/* Intestazione Bambino Esclusiva */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 glass-card p-5 border-emerald-500/30">
            <div className="flex items-center gap-3">
              <ChildAvatarWithBadge
                name={children.find((c) => c.id === selectedChildId)?.name || "Bambino"}
                avatarPresetId={children.find((c) => c.id === selectedChildId)?.avatar_preset_id}
                activeBadgeId={activeBadgeId}
                activeFrameId={activeFrameId}
                cosmeticsMap={Object.fromEntries(cosmetics.map(c => [c.id, c.icon_preset]))}
                size="md"
                imgClassName="border-emerald-500/40 shadow-lg"
              />
              <div>
                <h1 className="text-xl font-black text-white flex items-center gap-1.5">
                  Libreria di {children.find((c) => c.id === selectedChildId)?.name || "Favole"}
                  {activeBadgeId && (
                    <span className="text-base" title="Badge equipaggiato">
                      {getCosmeticIcon(cosmetics.find(c => c.id === activeBadgeId)?.icon_preset)}
                    </span>
                  )}
                </h1>
                <p className="text-xs text-emerald-300">
                  Esplora e leggi le storie magiche assegnate a te
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAccessibilityModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-indigo-300 hover:text-indigo-200 transition-all shrink-0 shadow-sm"
                title="Regola Comfort e Accessibilità di Lettura"
              >
                <Eye className="w-4 h-4 text-indigo-400" />
                <span className="hidden sm:inline">Aspetto</span>
              </button>

              <button
                onClick={() => setShowRewardsModal(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500/20 to-indigo-500/20 hover:from-amber-500/30 hover:to-indigo-500/30 border border-amber-400/50 text-amber-300 transition-all font-bold text-xs md:text-sm shadow-lg hover:scale-105"
              >
                <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                <span>★ {adventurePoints} Punti — Missioni & Premi</span>
              </button>

              <button
                onClick={() => setShowExitModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors shrink-0"
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Esci al Genitore</span>
              </button>
            </div>
          </div>

          {/* Banner di suggerimento rapido per i Punti Avventura */}
          <div className="glass-card p-4 border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-indigo-500/10 flex items-center justify-between text-xs text-slate-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Come accumulare punti:</strong> Leggi una storia fino all&apos;ultima pagina per ricevere <strong>+15 Punti Avventura</strong> e completare le missioni speciali!
              </span>
            </div>
            <button
              onClick={() => setShowRewardsModal(true)}
              className="text-amber-300 font-bold hover:underline shrink-0 ml-3"
            >
              Apri Negozio & Missioni →
            </button>
          </div>

          {loading ? (
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
            <div className="space-y-12">
              {/* Sezione 1: Continua a leggere */}
              {stories.filter((s) => s.reading_status === "in_progress").length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-bold text-white">Continua a Leggere</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stories
                      .filter((s) => s.reading_status === "in_progress")
                      .map((item) => renderStoryCard(item))}
                  </div>
                </div>
              )}

              {/* Sezione 2: Nuove storie da leggere */}
              {stories.filter((s) => s.reading_status === "new").length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Sparkles className="w-5 h-5 text-pink-400" />
                    <h2 className="text-lg font-bold text-white">Nuove Favole Pronta Per Te</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stories
                      .filter((s) => s.reading_status === "new")
                      .map((item) => renderStoryCard(item))}
                  </div>
                </div>
              )}

              {/* Sezione 3: Già lette */}
              {stories.filter((s) => s.reading_status === "completed").length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-lg font-bold text-white">Storie Completate</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stories
                      .filter((s) => s.reading_status === "completed")
                      .map((item) => renderStoryCard(item))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Toast Premio */}
      {rewardToast && (
        <div className="fixed bottom-6 right-6 z-50 glass-card p-4 border-amber-400/60 bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-2 shadow-xl animate-bounce">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span>{rewardToast}</span>
        </div>
      )}

      {/* Modale Gamification */}
      <GamificationModal
        isOpen={showRewardsModal}
        onClose={() => setShowRewardsModal(false)}
        adventurePoints={adventurePoints}
        quests={quests}
        questProgress={questProgress}
        cosmetics={cosmetics}
        unlockedCosmetics={unlockedCosmetics}
        familyTier={familyTier}
        activeBackdrop={activeBadgeId}
        activeFrame={activeFrameId}
        childId={selectedChildId || ''}
        onUnlockCosmetic={handleUnlockCosmetic}
        onSetActiveCosmetic={handleSetActiveCosmetic}
        onPointsUpdate={(pts) => setAdventurePoints(pts)}
        rewardToast={rewardToast}
        isChildMode={isChildModeSession}
      />

      {/* Modale PIN Uscita al Genitore */}
      {showExitModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
                inputMode="numeric"
                pattern="[0-9]*"
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

      <ReadingAccessibilityModal
        isOpen={showAccessibilityModal}
        onClose={() => setShowAccessibilityModal(false)}
        childId={selectedChildId || ""}
        nightMode={readingNightMode}
        brightness={readingBrightness}
        contrast={readingContrast}
        fontSize={readingFontSize}
        isChildMode={isChildModeSession}
        onUpdate={(prefs) => {
          setReadingNightMode(prefs.nightMode);
          setReadingBrightness(prefs.brightness);
          setReadingContrast(prefs.contrast);
          setReadingFontSize(prefs.fontSize);
          setChildren((prev) =>
            prev.map((c) =>
              c.id === selectedChildId
                ? {
                    ...c,
                    night_mode: prefs.nightMode,
                    brightness: prefs.brightness,
                    contrast: prefs.contrast,
                    font_size: prefs.fontSize,
                  }
                : c
            )
          );
        }}
      />
    </>
  );
}
