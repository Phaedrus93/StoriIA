"use client";

import React, { useState, useEffect } from "react";
import { Eye, Sun, Moon, Type, Sliders, X, Check, Sparkles } from "lucide-react";

interface ReadingAccessibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  childId: string;
  nightMode: boolean;
  brightness: number;
  contrast: number;
  fontSize: string;
  isChildMode: boolean;
  onUpdate: (prefs: { nightMode: boolean; brightness: number; contrast: number; fontSize: string }) => void;
}

export default function ReadingAccessibilityModal({
  isOpen,
  onClose,
  childId,
  nightMode: initialNightMode,
  brightness: initialBrightness,
  contrast: initialContrast,
  fontSize: initialFontSize,
  isChildMode,
  onUpdate,
}: ReadingAccessibilityModalProps) {
  const [nightMode, setNightMode] = useState(initialNightMode);
  const [brightness, setBrightness] = useState(initialBrightness);
  const [contrast, setContrast] = useState(initialContrast);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    setNightMode(initialNightMode);
    setBrightness(initialBrightness);
    setContrast(initialContrast);
    setFontSize(initialFontSize);
  }, [initialNightMode, initialBrightness, initialContrast, initialFontSize]);

  if (!isOpen) return null;

  const handleSave = async (applyToAll: boolean = false) => {
    setStatus(null);
    setSaving(true);
    try {
      const body: any = {
        night_mode: nightMode,
        brightness,
        contrast,
        font_size: fontSize,
      };
      if (applyToAll) {
        body.applyToAll = true;
      } else {
        body.childId = childId;
      }

      const res = await fetch("/api/child/accessibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore durante il salvataggio");
      }

      setStatus({
        type: "success",
        msg: applyToAll
          ? "Preferenze applicate a tutti i bambini!"
          : "Preferenze di lettura salvate!",
      });

      onUpdate({ nightMode, brightness, contrast, fontSize });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Comfort di Lettura</h3>
              <p className="text-[11px] text-slate-400">Regola il testo e i colori su misura per te</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {status && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              status.type === "success"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
            }`}
          >
            {status.msg}
          </div>
        )}

        <div className="space-y-5">
          {/* Modalità Notte */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="font-bold text-sm flex items-center gap-2">
              {nightMode ? <Moon className="w-4 h-4 text-amber-300" /> : <Sun className="w-4 h-4 text-amber-400" />}
              Modalità Notte
            </span>
            <button
              type="button"
              onClick={() => {
                const next = !nightMode;
                setNightMode(next);
                onUpdate({ nightMode: next, brightness, contrast, fontSize });
              }}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                nightMode ? "bg-indigo-600" : "bg-slate-800"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  nightMode ? "translate-x-6" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Dimensione Testo */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
              <Type className="w-4 h-4 text-indigo-400" />
              Dimensione Testo
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "small", label: "A-" },
                { id: "medium", label: "A" },
                { id: "large", label: "A+" },
                { id: "xlarge", label: "A++" },
              ].map((fs) => (
                <button
                  key={fs.id}
                  type="button"
                  onClick={() => {
                    setFontSize(fs.id);
                    onUpdate({ nightMode, brightness, contrast, fontSize: fs.id });
                  }}
                  className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${
                    fontSize === fs.id
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-sm scale-105"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {fs.label}
                </button>
              ))}
            </div>
          </div>

          {/* Luminosità */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-400 uppercase">Luminosità</span>
              <span className="text-indigo-400">{brightness}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="150"
              step="5"
              value={brightness}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBrightness(val);
                onUpdate({ nightMode, brightness: val, contrast, fontSize });
              }}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Contrasto */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-400 uppercase">Contrasto</span>
              <span className="text-indigo-400">{contrast}%</span>
            </div>
            <input
              type="range"
              min="70"
              max="150"
              step="5"
              value={contrast}
              onChange={(e) => {
                const val = Number(e.target.value);
                setContrast(val);
                onUpdate({ nightMode, brightness, contrast: val, fontSize });
              }}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            disabled={saving || !childId}
            onClick={() => handleSave(false)}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {saving ? "Salvataggio in corso..." : "Salva Preferenze"}
          </button>

          {!isChildMode && (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all disabled:opacity-50"
            >
              Applica a tutti i fratelli/sorelle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
