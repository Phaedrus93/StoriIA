"use client";

import React from "react";
import Link from "next/link";
import { Users, Compass, BookOpen, Sparkles, ArrowRight } from "lucide-react";

export default function LibraryOverviewPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-8">
      {/* Intestazione */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-pink-300 to-indigo-300">
          Libreria Creativa
        </h1>
        <p className="text-sm md:text-base text-slate-400 max-w-xl">
          Gestisci i protagonisti e i mondi incantati delle tue storie. Crea nuovi personaggi e ambientazioni da usare nelle favole generate dall&apos;AI.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Personaggi */}
        <Link
          href="/library/characters"
          className="group relative overflow-hidden p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-pink-500/50 hover:bg-slate-800/80 transition-all duration-300 shadow-lg"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-32 h-32 text-pink-400 rotate-[-10deg] scale-110" />
          </div>
          
          <div className="relative z-10 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/20 group-hover:scale-110 transition-transform">
              <Users className="w-7 h-7 text-white" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white group-hover:text-pink-300 transition-colors">
                Personaggi
              </h2>
              <p className="text-sm text-slate-400">
                Aggiungi e modifica i protagonisti magici, gli aiutanti e le creature che animeranno le tue avventure.
              </p>
            </div>
            
            <div className="pt-2 flex items-center text-sm font-bold text-pink-400 gap-2">
              <span>Esplora Personaggi</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>

        {/* Ambientazioni */}
        <Link
          href="/library/settings"
          className="group relative overflow-hidden p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/80 transition-all duration-300 shadow-lg"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Compass className="w-32 h-32 text-emerald-400 rotate-[10deg] scale-110" />
          </div>
          
          <div className="relative z-10 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
              <Compass className="w-7 h-7 text-white" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                Ambientazioni
              </h2>
              <p className="text-sm text-slate-400">
                Crea boschi incantati, regni sottomarini e castelli magici. Definisci dove si svolgeranno le storie.
              </p>
            </div>
            
            <div className="pt-2 flex items-center text-sm font-bold text-emerald-400 gap-2">
              <span>Esplora Ambientazioni</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>
      </div>
      
      {/* Quick Action Banner */}
      <div className="mt-8 p-6 rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-900/30 via-purple-900/20 to-indigo-900/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-indigo-500/20 text-indigo-400 hidden sm:block">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm sm:text-base">Sei pronto a creare magia?</h3>
            <p className="text-xs sm:text-sm text-indigo-300/80">I tuoi personaggi ti aspettano in una nuova avventura.</p>
          </div>
        </div>
        <Link 
          href="/stories/new"
          className="shrink-0 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all"
        >
          Crea Favola
        </Link>
      </div>
    </div>
  );
}
