import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HomeHeaderNav from "./HomeHeaderNav";
import {
  Sparkles,
  BookOpen,
  ShieldCheck,
  Wand2,
  Users,
  Heart,
  ArrowRight,
  Smile,
} from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden flex flex-col justify-between">
      {/* Sfondo con bagliori dinamici Glassmorphism */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Intestazione principale */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/30">
            S
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-white">
              Stori<span className="text-indigo-400">IA</span>
            </span>
            <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold">
              AI Agentic Stories
            </span>
          </div>
        </div>

        <HomeHeaderNav isAuthenticated={!!user} />
      </header>

      {/* Sezione Hero Principale */}
      <main className="max-w-6xl mx-auto px-6 py-12 md:py-20 space-y-16">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span>Favole Magiche Generate con Google Gemini AI</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
            Avventure Incantate su Misura per i Tuoi{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Bambini
            </span>
          </h1>

          <p className="text-slate-400 text-base md:text-lg leading-relaxed">
            Un'esperienza educativa e protetta per la famiglia: inventa personaggi, scegli lezioni morali e regala ai tuoi piccoli una libreria magica e sicura.
          </p>

          {/* Pulsanti Azione Principali */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/stories/new"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-sm shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-3 transform hover:-translate-y-0.5 transition-all"
            >
              <Wand2 className="w-5 h-5" />
              <span>Crea Nuova Favola AI</span>
            </Link>

            <Link
              href="/read"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-sm shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 transform hover:-translate-y-0.5 transition-all"
            >
              <Smile className="w-5 h-5" />
              <span>Modalità Lettura Bambino</span>
            </Link>
          </div>
        </div>

        {/* Griglia Accesso Rapido Moduli StoriIA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Dashboard e Archivio */}
          <Link
            href="/dashboard"
            className="glass-card p-7 hover:border-indigo-500/50 transition-all transform hover:-translate-y-1.5 group flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white group-hover:text-indigo-300 transition-colors">
                Archivio & Dashboard
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Esplora le storie create, monitora l&apos;avanzamento di lettura dei tuoi figli e gestisci le assegnazioni.
              </p>
            </div>
            <div className="pt-6 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-indigo-400">
              <span>Entra in Dashboard</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Laboratorio Personaggi */}
          <Link
            href="/library/characters"
            className="glass-card p-7 hover:border-purple-500/50 transition-all transform hover:-translate-y-1.5 group flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white group-hover:text-purple-300 transition-colors">
                Laboratorio Personaggi
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Crea eroi indimenticabili, imposta i loro tratti e rendili protagonisti delle tue prossime avventure.
              </p>
            </div>
            <div className="pt-6 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-purple-400">
              <span>Crea Personaggi</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Sicurezza Famiglia */}
          <Link
            href="/children"
            className="glass-card p-7 hover:border-emerald-500/50 transition-all transform hover:-translate-y-1.5 group flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white group-hover:text-emerald-300 transition-colors">
                Profili Bambino & PIN
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Configura i profili dei tuoi figli, seleziona avatar educativi e proteggi l&apos;area genitori con PIN sicuro.
              </p>
            </div>
            <div className="pt-6 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-400">
              <span>Gestisci Famiglia</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Banner Sicurezza e Conformità */}
        <div className="glass-card p-6 md:p-8 border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                Sicurezza & Isolamento RLS di Grado Bancario
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                I dati dei minori sono protetti da Row Level Security e hashing OWASP su PostgreSQL.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
            <span>Pensato per crescere insieme</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full px-6 py-8 border-t border-slate-900 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} StoriIA — AI Agentic Storytelling per la Famiglia.
      </footer>
    </div>
  );
}
