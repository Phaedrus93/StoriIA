import React from "react";
import {
  Sparkles,
  Wand2,
  Download,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Clock,
  Users,
} from "lucide-react";

export interface ChildProfileOption {
  id: string;
  name: string;
}

export interface StoryAssignment {
  id: string;
  child_profile_id: string;
  reading_status: "new" | "in_progress" | "completed";
  last_read_position: number;
}

export interface UnifiedStory {
  id: string;
  source?: string;
  target_age_range: string;
  generated_text: string;
  created_at: string;
  pdf_storage_path?: string | null;
  assignments?: StoryAssignment[];
}

interface StoryCardUnifiedProps {
  story: UnifiedStory;
  childrenProfiles: ChildProfileOption[];
  onToggleAssignment: (e: React.MouseEvent, storyId: string, childId: string) => void;
  onGenerateOrDownloadPdf: (story: UnifiedStory) => void;
  onReportStory: (story: UnifiedStory) => void;
  onDeleteStory: (story: UnifiedStory) => void;
  loadingPdfId: string | null;
}

export default function StoryCardUnified({
  story,
  childrenProfiles,
  onToggleAssignment,
  onGenerateOrDownloadPdf,
  onReportStory,
  onDeleteStory,
  loadingPdfId,
}: StoryCardUnifiedProps) {
  const isPreset = story.source === "preset";
  const firstLine = story.generated_text.split("\n")[0] || "Storia Senza Titolo";
  const title = firstLine.replace(/^#\s*/, "").trim();
  const assignments = story.assignments || [];

  return (
    <div className="glass-card p-6 border-slate-800/80 hover:border-slate-700 space-y-5 transition-all duration-300 shadow-lg flex flex-col justify-between">
      <div className="space-y-4">
        {/* Intestazione Card: Badge Fonte, Età, Data e Azioni Rapide */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {isPreset ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold text-[11px] shadow-sm">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Favola Predefinita</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 font-bold text-[11px] shadow-sm">
                <Wand2 className="w-3 h-3 text-indigo-400" />
                <span>Generata con AI</span>
              </span>
            )}

            <span className="badge-glow text-[10px]">
              Fascia {story.target_age_range} anni
            </span>

            <span className="text-[11px] text-slate-400">
              {new Date(story.created_at).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Pulsanti di Azione: PDF, Segnala, Elimina (solo AI) */}
          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              id={`pdf-btn-${story.id}`}
              onClick={() => onGenerateOrDownloadPdf(story)}
              disabled={loadingPdfId === story.id}
              className="p-2 rounded-xl text-slate-300 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors flex items-center gap-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                story.pdf_storage_path
                  ? "Scarica PDF della favola"
                  : "Genera PDF impaginato della favola"
              }
            >
              {loadingPdfId === story.id ? (
                <>
                  <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
                  <span className="hidden sm:inline">
                    {story.pdf_storage_path ? "Apertura..." : "Generazione..."}
                  </span>
                </>
              ) : story.pdf_storage_path ? (
                <>
                  <Download className="w-4 h-4 text-indigo-400" />
                  <span className="hidden sm:inline">Scarica PDF</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Genera PDF</span>
                </>
              )}
            </button>

            <button
              id={`report-btn-${story.id}`}
              onClick={() => onReportStory(story)}
              className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
              title="Segnala contenuto problematico all'amministrazione"
            >
              <AlertTriangle className="w-4 h-4" />
            </button>

            {!isPreset && (
              <button
                id={`delete-btn-${story.id}`}
                onClick={() => onDeleteStory(story)}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Elimina definitivamente questa storia"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Titolo Principale */}
        <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
          {title}
        </h3>

        {/* Anteprima Testo Favola */}
        <div className="text-xs text-slate-300 leading-relaxed line-clamp-3 bg-slate-900/70 p-4 rounded-2xl border border-slate-800/80 shadow-inner">
          {story.generated_text}
        </div>
      </div>

      {/* Sezione Assegnazione ai Bambini */}
      <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Users className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Assegna per la Lettura Bambino:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {childrenProfiles.length === 0 ? (
            <span className="text-[11px] text-slate-500 italic">
              Nessun profilo bambino configurato
            </span>
          ) : (
            childrenProfiles.map((child) => {
              const assign = assignments.find(
                (a) => a.child_profile_id === child.id
              );
              const isAssigned = !!assign;
              const isCompleted = assign?.reading_status === "completed";
              const isInProgress = assign?.reading_status === "in_progress";

              return (
                <button
                  key={child.id}
                  onClick={(e) => onToggleAssignment(e, story.id, child.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border ${
                    isAssigned
                      ? isCompleted
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm"
                        : isInProgress
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm"
                        : "bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-sm"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                  }`}
                  title={
                    isAssigned
                      ? `Assegnata a ${child.name} (${
                          isCompleted
                            ? "Completata"
                            : isInProgress
                            ? `In lettura (${assign.last_read_position || 0}%)`
                            : "Da iniziare"
                        }) - Clicca per rimuovere`
                      : `Assegna questa storia a ${child.name}`
                  }
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isAssigned
                        ? isCompleted
                          ? "bg-emerald-400"
                          : isInProgress
                          ? "bg-amber-400"
                          : "bg-indigo-400 animate-pulse"
                        : "bg-slate-600"
                    }`}
                  />
                  <span>{child.name}</span>
                  {isAssigned && (
                    <span className="text-[10px] opacity-80 pl-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-400" />
                      ) : isInProgress ? (
                        `(${assign.last_read_position || 0}%)`
                      ) : (
                        "(Nuova)"
                      )}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
