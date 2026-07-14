"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  variant = "warning",
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const borderClass =
    variant === "danger"
      ? "border-rose-500/40"
      : variant === "info"
      ? "border-indigo-500/40"
      : "border-amber-500/40";

  const headerIconColor =
    variant === "danger"
      ? "text-rose-400"
      : variant === "info"
      ? "text-indigo-400"
      : "text-amber-400";

  const btnConfirmClass =
    variant === "danger"
      ? "bg-rose-600 hover:bg-rose-500 text-white"
      : variant === "info"
      ? "bg-indigo-600 hover:bg-indigo-500 text-white"
      : "bg-amber-600 hover:bg-amber-500 text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`max-w-md w-full glass-card p-6 border ${borderClass} space-y-4 shadow-2xl`}>
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 font-bold ${headerIconColor}`}>
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary text-xs !py-2 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${btnConfirmClass}`}
          >
            {isLoading && (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
