"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Sparkles, Lock, Mail } from "lucide-react";
import ForgotPasswordModal from "@/components/auth/ForgotPasswordModal";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
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
      setError(oauthError.message || "Impossibile avviare il login con Google.");
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Credenziali non valide. Controlla email e password.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
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
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-pink-500 flex items-center justify-center shadow-lg mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <span className="badge-glow mb-2">Area Genitori</span>
          <h1 className="text-2xl font-bold tracking-tight">Accedi a StoriIA</h1>
          <p className="text-sm text-slate-400 mt-1">
            Le tue storie personalizzate per momenti di lettura magici in famiglia
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

        <div className="mb-6 space-y-4">
          <button
            id="btn-google-login"
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
            <span>{googleLoading ? "Connessione in corso..." : "Continua con Google"}</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800/80 w-full"></div>
            <span className="bg-slate-950 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-widest absolute">
              Oppure
            </span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                id="email-input"
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Password dimenticata?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                id="password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field input-field-icon"
              />
            </div>
          </div>

          <button
            id="submit-login"
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? (
              <span>Accesso in corso...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Entra nella tua famiglia</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Non hai ancora un account?{" "}
          <Link
            id="link-register"
            href="/register"
            className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors"
          >
            Crea account famiglia
          </Link>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        defaultEmail={email}
      />
    </div>
  );
}
