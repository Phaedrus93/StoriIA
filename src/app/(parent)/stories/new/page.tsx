"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles,
  BookOpen,
  Heart,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import type { AgeRange } from "@/lib/ai/story-generator";
import { APP_CONFIG } from "@/lib/config";

interface Character {
  id: string;
  name: string;
  traits: string;
}

interface Setting {
  id: string;
  name: string;
  description: string;
}

interface ChildProfile {
  id: string;
  name: string;
}

const DEFAULT_MORALS = [
  {
    title: "Condivisione e generosità",
    description: "È bello dividere i giochi e le merende con gli amici e i fratelli.",
  },
  {
    title: "Il coraggio di provare cose nuove",
    description: "Superare la paura dell'ignoto affrontando una piccola sfida con fiducia.",
  },
  {
    title: "Il valore dell'ascolto e della pazienza",
    description: "Rispettare il proprio turno e ascoltare le parole degli altri con attenzione.",
  },
  {
    title: "Rispetto per la natura e gli animali",
    description: "Prendersi cura dei piccoli esseri viventi e proteggere l'ambiente.",
  },
  {
    title: "L'importanza della sincerità",
    description: "Dire sempre la verità, perché l'onestà rende le amicizie più forti.",
  },
];

export default function NewStoryPage() {
  const [ageRange, setAgeRange] = useState<AgeRange>("4-6");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [children, setChildren] = useState<ChildProfile[]>([]);

  // Selezioni
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");
  const [selectedSettingId, setSelectedSettingId] = useState<string>("");
  const [selectedMoralIndex, setSelectedMoralIndex] = useState<number>(0);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);

  // Stato generazione
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedStory, setGeneratedStory] = useState<{
    id: string;
    generated_text: string;
  } | null>(null);
  const [todayCount, setTodayCount] = useState<number>(0);
  const maxDaily = APP_CONFIG.generationLimit.maxPerFamilyPer24Hours;

  const supabase = createClient();

  useEffect(() => {
    loadLibraryAndChildren();
  }, []);

  async function loadLibraryAndChildren() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: fam } = await supabase
        .from("families")
        .select("id")
        .eq("parent_user_id", user.id)
        .single();

      if (fam) {
        const { count } = await supabase
          .from("stories")
          .select("*", { count: "exact", head: true })
          .eq("family_id", fam.id)
          .neq("source", "preset")
          .gte("created_at", todayStart.toISOString());
        setTodayCount(count || 0);
      } else {
        setTodayCount(0);
      }
    } else {
      setTodayCount(0);
    }

    const { data: charData } = await supabase
      .from("characters")
      .select("id, name, traits");
    setCharacters(charData || []);

    if (charData && charData.length > 0) {
      setSelectedCharacterId(charData[0].id);
    }

    const { data: setData } = await supabase
      .from("settings")
      .select("id, name, description");
    setSettings(setData || []);

    if (setData && setData.length > 0) {
      setSelectedSettingId(setData[0].id);
    }

    const { data: childData } = await supabase
      .from("child_profiles")
      .select("id, name");
    setChildren(childData || []);

    if (childData && childData.length > 0) {
      setSelectedChildIds([childData[0].id]);
    }
  }

  const toggleChildSelection = (childId: string) => {
    if (selectedChildIds.includes(childId)) {
      setSelectedChildIds(selectedChildIds.filter((id) => id !== childId));
    } else {
      setSelectedChildIds([...selectedChildIds, childId]);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);
    setGeneratedStory(null);

    const selectedChar = characters.find((c) => c.id === selectedCharacterId);
    const selectedSet = settings.find((s) => s.id === selectedSettingId);
    const moral = DEFAULT_MORALS[selectedMoralIndex];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          ageRange,
          characterId: selectedCharacterId || null,
          characterName: selectedChar?.name || "Lupo Coraggioso",
          characterTraits: selectedChar?.traits || "Intelligente e curioso",
          settingId: selectedSettingId || null,
          settingName: selectedSet?.name || "Foresta Magica",
          settingDescription:
            selectedSet?.description || "Un bosco pieno di segreti",
          moralLessonTitle: moral.title,
          moralLessonDescription: moral.description,
          assignToChildIds: selectedChildIds,
        }),
      });

      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore durante la generazione");
      }

      setGeneratedStory(data.story);
      setTodayCount((prev) => prev + 1);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        setError(
          "Tempo di attesa scaduto (35 secondi). La generazione sta richiedendo più tempo del previsto, riprova tra poco."
        );
      } else {
        setError(err instanceof Error ? err.message : "Errore di generazione");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 relative">
      <div>
        <Link
          href="/dashboard"
          className="text-xs font-semibold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 mb-3"
        >
          ← Torna alla Dashboard Genitore
        </Link>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-amber-400" />
          <span>Generatore Storie AI su Misura</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Scegli età, protagonista, ambientazione e lezione morale. L&apos;IA scriverà una favola unica per la tua famiglia.
        </p>
      </div>

      {/* Contatore e Progress Bar Generazioni Oggi */}
      <div className="glass-card p-4 border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white">Limite Generazioni Giornaliere</h3>
          <p className="text-xs text-slate-400">
            Storie generate oggi:{" "}
            <span className="text-indigo-400 font-semibold">{todayCount}</span> /{" "}
            {maxDaily}
          </p>
        </div>
        <div className="w-full sm:w-48 bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-indigo-500 to-pink-500 h-full transition-all duration-300"
            style={{
              width: `${Math.min(100, (todayCount / maxDaily) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Landing Page d'Attesa a Schermo Intero durante la Generazione */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center space-y-8 animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center animate-pulse shadow-2xl shadow-indigo-500/50">
              <Sparkles className="w-12 h-12 text-white animate-spin" />
            </div>
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              Creazione della Magia in corso...
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              L&apos;IA sta tessendo la tua favola personalizzata con i personaggi, l&apos;ambientazione e la morale selezionati. Attendi qualche secondo senza ricaricare la pagina.
            </p>
          </div>
          <div className="w-64 bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 via-pink-500 to-amber-400 h-full w-full animate-pulse" />
          </div>
        </div>
      )}

      {generatedStory ? (
        <div className="glass-card p-8 border-indigo-500/40 space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center gap-3 text-emerald-400 font-bold">
            <CheckCircle2 className="w-6 h-6" />
            <span>Favola Generata con Successo!</span>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-200 leading-relaxed whitespace-pre-line text-sm max-h-[400px] overflow-y-auto">
            {generatedStory.generated_text}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-4 pt-2">
            <button
              onClick={() => setGeneratedStory(null)}
              className="btn-secondary text-xs"
            >
              Crea una Nuova Favola
            </button>
            <a
              href="/stories"
              className="btn-primary text-xs flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>Vai all&apos;Archivio Storie</span>
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={handleGenerate} className="space-y-8">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Selezione Fascia d'Età */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-bold text-lg text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <span>1. Seleziona la Fascia d&apos;Età</span>
            </h2>

            <div className="grid grid-cols-3 gap-4">
              {(["0-3", "4-6", "7-10"] as AgeRange[]).map((age) => {
                const active = ageRange === age;
                return (
                  <button
                    key={age}
                    type="button"
                    onClick={() => setAgeRange(age)}
                    className={`p-4 rounded-2xl border text-center transition-all ${
                      active
                        ? "bg-indigo-600/30 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                        : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-lg font-bold">{age} anni</div>
                    <div className="text-[11px] mt-1 text-slate-300">
                      {age === "0-3"
                        ? "Ritmico, dolce e per la nanna"
                        : age === "4-6"
                        ? "Fiaba magica con piccola sfida"
                        : "Avventura con trama articolata"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Personaggio e Ambientazione */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-bold text-lg text-white">2. Protagonista</h2>
              {characters.length === 0 ? (
                <div className="text-xs text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                  Nessun personaggio salvato. Verrà usato un protagonista predefinito o creane uno nel Character Builder.
                </div>
              ) : (
                <select
                  value={selectedCharacterId}
                  onChange={(e) => setSelectedCharacterId(e.target.value)}
                  className="input-field"
                >
                  {characters.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900">
                      {c.name} ({c.traits})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="glass-card p-6 space-y-4">
              <h2 className="font-bold text-lg text-white">3. Ambientazione</h2>
              {settings.length === 0 ? (
                <div className="text-xs text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                  Nessuna ambientazione salvata. Verrà usato un mondo magico predefinito o crealo nel Setting Builder.
                </div>
              ) : (
                <select
                  value={selectedSettingId}
                  onChange={(e) => setSelectedSettingId(e.target.value)}
                  className="input-field"
                >
                  {settings.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900">
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 4. Lezione Morale */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-bold text-lg text-white flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-400" />
              <span>4. Scegli la Morale della Favola</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DEFAULT_MORALS.map((moral, idx) => {
                const active = selectedMoralIndex === idx;
                return (
                  <button
                    key={moral.title}
                    type="button"
                    onClick={() => setSelectedMoralIndex(idx)}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      active
                        ? "bg-pink-600/20 border-pink-500 text-white shadow-md shadow-pink-500/10"
                        : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <strong className="text-xs font-bold block mb-1">
                      {moral.title}
                    </strong>
                    <span className="text-[11px] text-slate-400 block line-clamp-2">
                      {moral.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Assegnazione ai Bambini */}
          {children.length > 0 && (
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-bold text-lg text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <span>5. Assegna a Quali Figli?</span>
              </h2>

              <div className="flex flex-wrap gap-3">
                {children.map((child) => {
                  const active = selectedChildIds.includes(child.id);
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => toggleChildSelection(child.id)}
                      className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        active
                          ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                          : "bg-slate-900/60 border-slate-800 text-slate-400"
                      }`}
                    >
                      {active ? "✓ " : "+ "} {child.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isGenerating}
            className="btn-primary w-full py-4 text-base shadow-xl shadow-indigo-600/30"
          >
            <Sparkles className="w-5 h-5" />
            <span>
              {isGenerating
                ? "L'IA sta scrivendo la favola su misura..."
                : "Genera Favola AI Ora"}
            </span>
          </button>
        </form>
      )}
    </div>
  );
}
