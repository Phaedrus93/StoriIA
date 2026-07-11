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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
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
        console.error("Errore creazione record famiglia:", familyError);
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
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                id="reg-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="genitore@famiglia.it"
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Password (min. 6 caratteri)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                id="reg-password-input"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field pl-10"
              />
            </div>
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
