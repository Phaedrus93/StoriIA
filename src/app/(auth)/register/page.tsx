"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Sparkles, Lock, Mail, Users, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    const supabase = createClient();
    const redirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : "/auth/callback";

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (oauthError) {
      setError(oauthError.message || "Impossibile avviare la registrazione con Google.");
      setGoogleLoading(false);
    }
  };

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

      // Se Supabase richiede conferma email (session === null), mostriamo schermata informativa
      if (!signUpData.session) {
        setVerificationSent(true);
        setLoading(false);
        return;
      }

      // Altrimenti il login è immediato: creazione del record nella tabella families
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

        {verificationSent ? (
          <div className="space-y-6 text-center py-4">
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-3">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
              <div className="font-bold text-base">Verifica il tuo indirizzo email</div>
              <p className="text-xs text-emerald-200/80 leading-relaxed">
                Abbiamo inviato una mail di conferma all&apos;indirizzo <strong className="text-white">{email}</strong>.
                Clicca sul link di verifica contenuto nell&apos;email per attivare il tuo account e accedere subito al pannello famiglia.
              </p>
            </div>
            <Link
              href="/login"
              className="btn-primary w-full block text-center py-3 text-xs font-semibold"
            >
              Vai alla pagina di Login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 space-y-4">
              <button
                id="btn-google-register"
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading || loading}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-white font-semibold text-xs flex items-center justify-center gap-2.5 shadow-md transition-all disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.1 8.9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.4C.6 9.4 0 11.6 0 14c0 2.4.6 4.6 1.6 6.6l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5.2L1.6 16c1.9 3.8 5.8 6.4 10.4 6.4z"
                  />
                </svg>
                <span>{googleLoading ? "Connessione in corso..." : "Registrati con Google"}</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-800/80 w-full"></div>
                <span className="bg-slate-950 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-widest absolute">
                  Oppure
                </span>
              </div>
            </div>

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
        </>
        )}

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
