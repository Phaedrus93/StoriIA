"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, X, Send } from "lucide-react";

interface ContentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyId: string;
  storyTitle: string;
}

const CATEGORIES = [
  {
    id: "inappropriate_theme",
    label: "Tema spaventoso o inadatto alla fascia d'età",
    description: "Il racconto presenta scene o argomenti troppo intensi per i bambini selezionati.",
  },
  {
    id: "bad_language",
    label: "Linguaggio improprio, violento o offensivo",
    description: "Presenza di termini o espressioni non consoni a un ambiente educativo infantile.",
  },
  {
    id: "moral_inconsistency",
    label: "Morale incoerente o diseducativa",
    description: "L'insegnamento finale non corrisponde alla morale scelta o risulta fuorviante.",
  },
  {
    id: "technical_defect",
    label: "Difetto tecnico, testo tronco o mal formattato",
    description: "Il testo si interrompe bruscamente, presenta ripetizioni o errori di sintassi.",
  },
  {
    id: "other",
    label: "Altro motivo",
    description: "Segnalazione per una problematica differente da quelle elencate sopra.",
  },
];

export default function ContentReportModal({
  isOpen,
  onClose,
  storyId,
  storyTitle,
}: ContentReportModalProps) {
  const [category, setCategory] = useState("inappropriate_theme");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/stories/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story_id: storyId,
          reason_category: category,
          details: details.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.error || "Errore durante l'invio della segnalazione.");
      }
    } catch {
      setError("Errore di rete durante la comunicazione col server.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccess(false);
    setError(null);
    setCategory("inappropriate_theme");
    setDetails("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-card p-6 border-amber-500/30 space-y-5 shadow-2xl relative">
        <button
          type="button"
          onClick={handleResetAndClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-white">Segnalazione Inviata</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Grazie per la tua segnalazione per &ldquo;<strong>{storyTitle}</strong>&rdquo;. Il nostro team di moderazione verificherà il contenuto al più presto per mantenere l&apos;ambiente magico e sicuro per tutte le famiglie.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="btn-primary w-full py-2.5 text-xs font-semibold"
              >
                Chiudi Modale
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white leading-tight">Segnala Contenuto</h3>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[240px]">
                  {storyTitle}
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Seleziona il motivo della segnalazione:
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {CATEGORIES.map((cat) => (
                  <label
                    key={cat.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      category === cat.id
                        ? "bg-amber-500/10 border-amber-500/50 text-amber-200"
                        : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason_category"
                      value={cat.id}
                      checked={category === cat.id}
                      onChange={(e) => setCategory(e.target.value)}
                      className="mt-0.5 rounded-full bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-white">{cat.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                        {cat.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Note o dettagli specifici (Opzionale):
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Indica qui la frase o il passaggio specifico che ti ha causato preoccupazione..."
                className="input-field w-full text-xs placeholder:text-slate-500 resize-none"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Aiutaci a capire meglio il contesto</span>
                <span>{details.length}/500</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleResetAndClose}
                disabled={submitting}
                className="btn-secondary px-4 py-2 text-xs"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? "Invio in corso..." : "Invia Segnalazione"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
