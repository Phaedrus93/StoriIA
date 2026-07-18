"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Sparkles, Lock, Mail, Users } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!acceptedTerms) {
        setError(
          "Devi accettare i Termini di Servizio e l'Informativa sulla Privacy per procedere."
        );
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError("La password deve essere di almeno 6 caratteri.");
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError || !signUpData.user) {
        setError(signUpError?.message || "Impossibile creare l'account.");
        setLoading(false);
        return;
      }

      // Creazione del record nella tabella families
      const { error: familyError } = await supabase
        .from("families")
        .insert({
          parent_user_id: signUpData.user.id,
        });

      if (familyError && !familyError.message.includes("duplicate")) {
        console.error("Errore creazione record famiglia:", familyError.message || familyError.code);
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Errore di rete o connessione a Supabase fallita."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-card p-8">
        <div className="mb-4">
          <Link
            href="/"
            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1"
          >
            ← Torna alla Home
          </Link>
        </div>

        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 to-amber-500 flex items-center justify-center shadow-lg mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <span className="badge-glow mb-2">Benvenuti</span>
          <h1 className="text-2xl font-bold tracking-tight">Crea Famiglia StoriIA</h1>
          <p className="text-sm text-slate-400 mt-1">
            Inizia a creare storie testuali magiche per i tuoi figli
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

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Email Genitore
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                id="reg-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="genitore@famiglia.it"
                className="input-field input-field-icon"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Password (min. 6 caratteri)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                id="reg-password-input"
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

          <div className="flex items-start gap-2 pt-1">
            <input
              id="accept-terms-checkbox"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
              required
            />
            <label
              htmlFor="accept-terms-checkbox"
              className="text-xs text-slate-300 leading-tight"
            >
              Dichiaro di essere maggiorenne e accetto i{" "}
              <Link
                href="/terms"
                target="_blank"
                className="text-indigo-400 hover:underline"
              >
                Termini di Servizio
              </Link>{" "}
              e l&apos;
              <Link
                href="/privacy"
                target="_blank"
                className="text-indigo-400 hover:underline"
              >
                Informativa sulla Privacy (GDPR)
              </Link>
              .
            </label>
          </div>

          <button
            id="submit-register"
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? (
              <span>Creazione account in corso...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Inizia Subito</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Hai già un account famiglia?{" "}
          <Link
            id="link-login"
            href="/login"
            className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors"
          >
            Accedi
          </Link>
        </div>
      </div>
    </div>
  );
}
