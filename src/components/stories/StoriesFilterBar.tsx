import React from "react";
import { Search, Filter, RotateCcw, Sparkles, Wand2, Users, BookOpen } from "lucide-react";

export interface StoryFilterState {
  searchQuery: string;
  sourceFilter: "all" | "ai_generated" | "preset";
  ageFilter: "all" | "0-3" | "4-6" | "7-10";
  childFilter: string; // "all" oppure l'ID del bambino
  statusFilter: "all" | "new" | "in_progress" | "completed" | "unassigned";
}

interface ChildProfileOption {
  id: string;
  name: string;
}

interface StoriesFilterBarProps {
  filters: StoryFilterState;
  onFilterChange: (newFilters: StoryFilterState) => void;
  childrenOptions: ChildProfileOption[];
  totalCount: number;
  filteredCount: number;
}

export default function StoriesFilterBar({
  filters,
  onFilterChange,
  childrenOptions,
  totalCount,
  filteredCount,
}: StoriesFilterBarProps) {
  const hasActiveFilters =
    filters.searchQuery !== "" ||
    filters.sourceFilter !== "all" ||
    filters.ageFilter !== "all" ||
    filters.childFilter !== "all" ||
    filters.statusFilter !== "all";

  const handleReset = () => {
    onFilterChange({
      searchQuery: "",
      sourceFilter: "all",
      ageFilter: "all",
      childFilter: "all",
      statusFilter: "all",
    });
  };

  return (
    <div className="glass-card p-6 border-slate-800/80 space-y-5 shadow-xl">
      {/* Barra di ricerca testuale e contatori visualizzazione */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id="stories-search-input"
            type="text"
            placeholder="Cerca per titolo o parola chiave nel testo della favola..."
            value={filters.searchQuery}
            onChange={(e) =>
              onFilterChange({ ...filters, searchQuery: e.target.value })
            }
            className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Visualizzate <strong className="text-white">{filteredCount}</strong> di{" "}
              {totalCount} storie
            </span>
          </div>

          {hasActiveFilters && (
            <button
              id="reset-stories-filters-btn"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/15 text-slate-300 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Reimposta tutti i filtri"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reimposta</span>
            </button>
          )}
        </div>
      </div>

      {/* Griglia dei 4 selettori (Fonte, Fascia Età, Bambino, Stato Lettura) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Filtro Fonte */}
        <div className="space-y-1">
          <label
            htmlFor="filter-source"
            className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider"
          >
            Fonte Contenuto
          </label>
          <div className="relative">
            <select
              id="filter-source"
              value={filters.sourceFilter}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  sourceFilter: e.target.value as StoryFilterState["sourceFilter"],
                })
              }
              className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none transition-all appearance-none pr-8"
            >
              <option value="all">Tutte le fonti (AI + Preset)</option>
              <option value="ai_generated">✨ Generate con AI da Gemini</option>
              <option value="preset">👑 Favole Predefinite di Sistema</option>
            </select>
          </div>
        </div>

        {/* 2. Filtro Fascia d'Età */}
        <div className="space-y-1">
          <label
            htmlFor="filter-age"
            className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider"
          >
            Fascia d&apos;Età
          </label>
          <select
            id="filter-age"
            value={filters.ageFilter}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                ageFilter: e.target.value as StoryFilterState["ageFilter"],
              })
            }
            className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none transition-all appearance-none pr-8"
          >
            <option value="all">Tutte le fasce d&apos;età</option>
            <option value="0-3">0-3 anni (Piccolissimi)</option>
            <option value="4-6">4-6 anni (Pre-scolari)</option>
            <option value="7-10">7-10 anni (Scolari)</option>
          </select>
        </div>

        {/* 3. Filtro Bambino Assegnato */}
        <div className="space-y-1">
          <label
            htmlFor="filter-child"
            className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider"
          >
            Bambino Assegnato
          </label>
          <select
            id="filter-child"
            value={filters.childFilter}
            onChange={(e) =>
              onFilterChange({ ...filters, childFilter: e.target.value })
            }
            className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none transition-all appearance-none pr-8"
          >
            <option value="all">Tutti i bambini della famiglia</option>
            {childrenOptions.map((c) => (
              <option key={c.id} value={c.id}>
                👤 Assegnate a {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Filtro Stato Lettura */}
        <div className="space-y-1">
          <label
            htmlFor="filter-status"
            className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider"
          >
            Stato Lettura
          </label>
          <select
            id="filter-status"
            value={filters.statusFilter}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                statusFilter: e.target.value as StoryFilterState["statusFilter"],
              })
            }
            className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none transition-all appearance-none pr-8"
          >
            <option value="all">Tutti gli stati di lettura</option>
            <option value="new">🆕 Nuova / Da leggere</option>
            <option value="in_progress">📖 In lettura</option>
            <option value="completed">✅ Completata</option>
            <option value="unassigned">🚫 Non ancora assegnata</option>
          </select>
        </div>
      </div>
    </div>
  );
}
