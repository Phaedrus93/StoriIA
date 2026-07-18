"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { KeyRound, Mail, Sparkles, CheckCircle2, X } from "lucide-react";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  defaultEmail = "",
}: ForgotPasswordModalProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail(defaultEmail);
      setError(null);
      setSuccess(false);
      setLoading(false);
    }
  }, [isOpen, defaultEmail]);

  if (!isOpen) return null;

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Inserisci un indirizzo email valido.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/update-password`
      : "/update-password";

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo }
    );

    if (resetError) {
      setError(
        resetError.message || "Impossibile inviare l'email di recupero. Riprova più tardi."
      );
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="max-w-md w-full glass-card p-6 border-slate-800 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          title="Chiudi modale"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Recupero Password</h2>
          <p className="text-xs text-slate-400 mt-1">
            Riceverai un link sicuro via email per impostare una nuova password per la tua famiglia.
          </p>
        </div>

        {success ? (
          <div className="space-y-6 text-center">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
              <div className="font-bold text-sm">Email Inviata con Successo</div>
              <p className="text-xs text-emerald-200/80 leading-relaxed">
                Abbiamo inviato le istruzioni di recupero a <strong className="text-white">{email}</strong>.
                Controlla la tua casella di posta principale e la cartella spam.
              </p>
            </div>
            <button
              onClick={onClose}
              className="btn-primary w-full text-xs py-2.5"
            >
              <span>Torna al Login</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendResetLink} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                Email Genitore
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="genitore@famiglia.it"
                  className="input-field input-field-icon text-sm"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary w-full sm:w-auto px-4 py-2 text-xs"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 py-2 text-xs"
              >
                {loading ? (
                  <span>Invio in corso...</span>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Invia Link di Recupero</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
