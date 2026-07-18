"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KeyRound, Sparkles, Lock, CheckCircle2 } from "lucide-react";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("La password deve essere composta da almeno 6 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le due password inserite non coincidono.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message || "Impossibile aggiornare la password. Il link potrebbe essere scaduto.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => {
      router.push("/dashboard");
    }, 2500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-card p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-pink-500 flex items-center justify-center shadow-lg mb-4">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <span className="badge-glow mb-2">Sicurezza Famiglia</span>
          <h1 className="text-2xl font-bold tracking-tight">Imposta Nuova Password</h1>
          <p className="text-sm text-slate-400 mt-1">
            Scegli una nuova password sicura per il tuo account StoriIA
          </p>
        </div>

        {error && (
          <div
            id="error-msg"
            className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm text-center"
          >
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-6 text-center py-4">
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-3">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
              <div className="font-bold text-base">Password Aggiornata con Successo!</div>
              <p className="text-xs text-emerald-200/80 leading-relaxed">
                La tua password è stata modificata correttamente. Stiamo reindirizzando la tua famiglia verso la dashboard...
              </p>
            </div>
            <Link
              href="/dashboard"
              className="btn-primary w-full block text-center py-3 text-xs font-semibold"
            >
              Vai subito alla Dashboard
            </Link>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Nuova Password (min. 6 caratteri)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="new-password-input"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field input-field-icon"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Conferma Nuova Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="confirm-password-input"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field input-field-icon"
                />
              </div>
            </div>

            <button
              id="submit-update-password"
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-4"
            >
              {loading ? (
                <span>Aggiornamento in corso...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Salva Nuova Password</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
