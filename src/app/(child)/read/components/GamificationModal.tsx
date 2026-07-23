"use client";

import React, { useState } from "react";
import {
  Trophy,
  Target,
  ShoppingBag,
  Sparkles,
  Check,
  Lock,
  X,
  Star,
  Shield,
  Zap,
  ChevronRight,
  Users,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Quest {
  id: string;
  title: string;
  description: string;
  target_count: number;
  points_reward: number;
  quest_type: string;
}

interface QuestProgress {
  quest_id: string;
  current_progress: number;
  completed_at: string | null;
}

interface CosmeticItem {
  id: string;
  name: string;
  category: "BADGE" | "AVATAR_FRAME";
  cost_points: number;
  icon_preset: string;
  requires_plan: string;
}

interface UnlockedCosmetic {
  cosmetic_id: string;
}

interface NarrativeItem {
  id: string;
  name: string;
  content_type: string;
  description: string;
  cost_points?: number;
  icon_preset: string;
}

interface UnlockedNarrativeItem {
  content_id: string;
  child_profile_id?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface GamificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  adventurePoints: number;
  quests: Quest[];
  questProgress: QuestProgress[];
  cosmetics: CosmeticItem[];
  unlockedCosmetics: UnlockedCosmetic[];
  narrativeCatalog?: NarrativeItem[];
  unlockedNarrative?: UnlockedNarrativeItem[];
  familyTier: string; // 'free' | 'premium' | 'family'
  activeBackdrop: string | null; // active_badge_id
  activeFrame: string | null; // active_frame_id
  childId: string;
  childrenList?: { id: string; name: string; adventure_points: number }[];
  onSelectChild?: (childId: string) => void;
  onUnlockCosmetic: (cosmeticId: string) => Promise<void>;
  onUnlockNarrative?: (contentId: string) => Promise<void>;
  onSetActiveCosmetic: (
    slot: "badge" | "frame",
    cosmeticId: string | null
  ) => Promise<void>;
  onPointsUpdate: (newPoints: number) => void;
  rewardToast: string | null;
  isChildMode?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCosmeticIcon(preset: string): string {
  const icons: Record<string, string> = {
    sparkles: "✨",
    rocket: "🚀",
    crown: "👑",
    star_frame: "⭐",
    snowflake: "❄️",
    flame: "🔥",
    cpu: "🤖",
    waves: "🌊",
    star: "⭐",
    trees: "🌲",
    castle: "🏰",
    anchor: "⚓",
    shield: "🛡️",
    search: "🔍",
  };
  return icons[preset] || "🎁";
}

function isPlanSufficient(
  requiredPlan: string,
  familyTier: string
): boolean {
  if (requiredPlan === "free") return true;
  if (requiredPlan === "premium" && (familyTier === "premium" || familyTier === "family"))
    return true;
  if (requiredPlan === "family" && familyTier === "family") return true;
  return false;
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = "missions" | "shop" | "narrative" | "badges";
type ShopFilter = "all" | "BADGE" | "AVATAR_FRAME";

// ─── Component ────────────────────────────────────────────────────────────────

export default function GamificationModal({
  isOpen,
  onClose,
  adventurePoints,
  quests,
  questProgress,
  cosmetics,
  unlockedCosmetics,
  narrativeCatalog,
  unlockedNarrative,
  familyTier,
  activeBackdrop,
  activeFrame,
  childId,
  childrenList,
  onSelectChild,
  onUnlockCosmetic,
  onUnlockNarrative,
  onSetActiveCosmetic,
  rewardToast,
  isChildMode,
}: GamificationModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("missions");
  const [shopFilter, setShopFilter] = useState<ShopFilter>("all");

  if (!isOpen) return null;

  const currentTab = isChildMode && (activeTab === "shop" || activeTab === "narrative") ? "missions" : activeTab;

  // ── Derived data ────────────────────────────────────────────────────────────

  const filteredCosmetics =
    shopFilter === "all"
      ? cosmetics
      : cosmetics.filter((c) => c.category === shopFilter);

  const unlockedBadges = cosmetics.filter(
    (c) =>
      c.category === "BADGE" &&
      unlockedCosmetics.some((u) => u.cosmetic_id === c.id)
  );

  const unlockedFrames = cosmetics.filter(
    (c) =>
      c.category === "AVATAR_FRAME" &&
      unlockedCosmetics.some((u) => u.cosmetic_id === c.id)
  );

  const hasBadgesSection = unlockedBadges.length > 0;
  const hasFramesSection = unlockedFrames.length > 0;
  const noUnlocked = !hasBadgesSection && !hasFramesSection;

  // ── Tab button helper ───────────────────────────────────────────────────────

  const tabCls = (tab: Tab) =>
    `flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
      currentTab === tab
        ? "bg-gradient-to-r from-amber-500/30 to-indigo-500/30 border border-amber-400/50 text-amber-300 shadow-md"
        : "text-slate-400 hover:text-white hover:bg-slate-800/60"
    }`;

  // ── Render: Missions tab ────────────────────────────────────────────────────

  const renderMissions = () => (
    <div className="space-y-3">
      {quests.length === 0 && (
        <div className="text-center text-slate-400 text-sm py-8">
          Nessuna missione disponibile al momento.
        </div>
      )}
      {quests.map((q) => {
        const prog = questProgress.find((p) => p.quest_id === q.id);
        const isCompleted = !!prog?.completed_at;
        const current = prog?.current_progress ?? 0;
        const pct = Math.min(100, Math.round((current / q.target_count) * 100));

        return (
          <div
            key={q.id}
            className={`p-4 rounded-2xl border transition-all ${
              isCompleted
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-slate-900/60 border-slate-800"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                  <span className="truncate">{q.title}</span>
                  {isCompleted && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                      Completata
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">{q.description}</p>
              </div>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full shrink-0">
                +{q.points_reward} ★
              </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-indigo-400 transition-all duration-500"
                  style={{ width: `${isCompleted ? 100 : pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                <span>
                  {isCompleted ? q.target_count : current} / {q.target_count}
                </span>
                <span>{isCompleted ? "100%" : `${pct}%`}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderChildSelector = () => {
    if (isChildMode || !childrenList || childrenList.length <= 1) return null;
    return (
      <div className="mb-4 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Users className="w-4 h-4 text-indigo-400" />
          <span>Profilo bambino su cui operare:</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {childrenList.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onSelectChild && onSelectChild(ch.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                ch.id === childId
                  ? "bg-amber-500/20 border border-amber-400/50 text-amber-300 shadow-sm"
                  : "bg-slate-800/60 text-slate-400 hover:text-white"
              }`}
            >
              {ch.name} ({ch.adventure_points} ★)
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ── Render: Shop tab ────────────────────────────────────────────────────────

  const renderShop = () => (
    <div className="space-y-4">
      {renderChildSelector()}
      {/* Inner filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "BADGE", "AVATAR_FRAME"] as ShopFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setShopFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              shopFilter === f
                ? "bg-indigo-500/30 border border-indigo-400/50 text-indigo-300"
                : "bg-slate-800/60 text-slate-400 hover:text-white"
            }`}
          >
            {f === "all" ? "Tutti" : f === "BADGE" ? "Badge" : "Cornici"}
          </button>
        ))}
      </div>

      {filteredCosmetics.length === 0 && (
        <div className="text-center text-slate-400 text-sm py-8">
          Nessun cosmetico disponibile.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredCosmetics.map((cosm) => {
          const isUnlocked = unlockedCosmetics.some(
            (u) => u.cosmetic_id === cosm.id
          );
          const planOk = isPlanSufficient(cosm.requires_plan, familyTier);
          const canAfford = adventurePoints >= cosm.cost_points;
          const locked = !planOk;

          return (
            <div
              key={cosm.id}
              className={`p-4 rounded-2xl border flex flex-col gap-3 transition-all ${
                isUnlocked
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : locked
                  ? "bg-slate-800/60 border-slate-700"
                  : "bg-slate-900/60 border-slate-800 hover:border-amber-500/40"
              }`}
            >
              {/* Icon + Meta */}
              <div className="flex items-center gap-3">
                <span
                  className="text-3xl select-none leading-none"
                  role="img"
                  aria-label={cosm.name}
                >
                  {getCosmeticIcon(cosm.icon_preset)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {cosm.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                      {cosm.category === "BADGE" ? "Badge" : "Cornice"}
                    </span>
                    <span className="text-xs font-bold text-amber-300">
                      {cosm.cost_points} ★
                    </span>
                  </div>
                </div>
              </div>

              {/* Action button */}
              {locked ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Richiede Piano{" "}
                      <strong className="text-slate-400">
                        {cosm.requires_plan.toUpperCase()}
                      </strong>
                    </span>
                  </div>
                  <button
                    disabled
                    className="w-full py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-500 cursor-not-allowed"
                  >
                    🔒 Non disponibile
                  </button>
                </div>
              ) : isUnlocked ? (
                <button
                  disabled
                  className="w-full py-2 rounded-xl text-xs font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 cursor-default flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Sbloccato
                </button>
              ) : canAfford ? (
                <button
                  onClick={() => onUnlockCosmetic(cosm.id)}
                  className="w-full py-2 rounded-xl text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Sblocca con {cosm.cost_points} ★
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-500 cursor-not-allowed"
                >
                  Punti insufficienti
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Render: Narrative Shop tab ──────────────────────────────────────────────

  const renderNarrativeShop = () => (
    <div className="space-y-4">
      {renderChildSelector()}
      <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs leading-relaxed">
        I contenuti narrativi sbloccati con i Punti Avventura di un bambino diventano immediatamente disponibili per creare storie per <strong>tutti i figli della famiglia</strong>!
      </div>

      {!narrativeCatalog || narrativeCatalog.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-8">
          Nessun contenuto narrativo disponibile nel catalogo.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {narrativeCatalog.map((item) => {
            const isUnlocked = unlockedNarrative && unlockedNarrative.some(
              (u) => u.content_id === item.id
            );
            const cost = item.cost_points ?? 40;
            const canAfford = adventurePoints >= cost;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                  isUnlocked
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-slate-900/60 border-slate-800 hover:border-indigo-500/40"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-3xl select-none leading-none">
                      {getCosmeticIcon(item.icon_preset)}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <span className="text-[10px] font-bold uppercase text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                        {item.content_type === "CHARACTER_TRAIT"
                          ? "Tratto"
                          : item.content_type === "SETTING_THEME"
                          ? "Ambientazione"
                          : "Stile"}
                      </span>
                      {!isUnlocked && (
                        <span className="text-xs font-bold text-amber-300">
                          {cost} ★
                        </span>
                      )}
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-2">{item.name}</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {isUnlocked ? (
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold pt-2 border-t border-slate-800/60">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Sbloccato per la famiglia</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onUnlockNarrative && onUnlockNarrative(item.id)}
                    disabled={!canAfford || !onUnlockNarrative}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      canAfford && onUnlockNarrative
                        ? "bg-gradient-to-r from-amber-500 to-indigo-500 text-white hover:opacity-90 shadow-md shadow-amber-500/10"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {canAfford
                        ? `Sblocca con ${cost} ★`
                        : `Punti insufficienti (${cost} ★)`}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Render: My Badges tab ───────────────────────────────────────────────────

  const renderMyBadges = () => {
    if (noUnlocked) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Trophy className="w-12 h-12 text-slate-700" />
          <p className="text-slate-400 text-sm text-center max-w-xs">
            Non hai ancora sbloccato nessun premio! Continua a leggere e
            accumula punti per sbloccare badge e cornici fantastici. 🌟
          </p>
        </div>
      );
    }

    const renderCosmeticCard = (cosm: CosmeticItem) => {
      const isBadge = cosm.category === "BADGE";
      const isActive = isBadge
        ? activeBackdrop === cosm.id
        : activeFrame === cosm.id;
      const slot: "badge" | "frame" = isBadge ? "badge" : "frame";

      return (
        <div
          key={cosm.id}
          className={`p-4 rounded-2xl border flex flex-col gap-3 transition-all ${
            isActive
              ? "bg-indigo-500/15 border-indigo-400/50 shadow-md shadow-indigo-500/10"
              : "bg-slate-900/60 border-slate-800"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-3xl select-none leading-none"
              role="img"
              aria-label={cosm.name}
            >
              {getCosmeticIcon(cosm.icon_preset)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{cosm.name}</p>
              <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                {cosm.category === "BADGE" ? "Badge" : "Cornice"}
              </span>
            </div>
            {isActive && (
              <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded-full shrink-0">
                Equipaggiato
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {isActive ? (
              <button
                onClick={() => onSetActiveCosmetic(slot, null)}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700"
              >
                Rimuovi
              </button>
            ) : (
              <button
                onClick={() => onSetActiveCosmetic(slot, cosm.id)}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-all flex items-center justify-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                Equipaggia
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        {hasBadgesSection && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Badge
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unlockedBadges.map((cosm) => renderCosmeticCard(cosm))}
            </div>
          </div>
        )}

        {hasFramesSection && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Star className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Cornici Avatar
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unlockedFrames.map((cosm) => renderCosmeticCard(cosm))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="max-w-2xl w-full glass-card border-amber-500/40 max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-card border-0 border-b border-slate-800 p-5 flex items-center justify-between bg-slate-950/90 backdrop-blur-sm rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/30 to-indigo-500/30 border border-amber-400/40 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                Missioni & Premi
              </h2>
              <div className="flex items-center gap-1 text-amber-300 font-bold text-sm">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{adventurePoints} Punti Avventura</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            aria-label="Chiudi modale"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-2 p-4 border-b border-slate-800 flex-wrap">
          <button
            id="tab-missions"
            onClick={() => setActiveTab("missions")}
            className={tabCls("missions")}
          >
            <Target className="w-4 h-4 shrink-0" />
            <span>Missioni</span>
          </button>
          {!isChildMode && (
            <>
              <button
                id="tab-shop"
                onClick={() => setActiveTab("shop")}
                className={tabCls("shop")}
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>Negozio Cosmetici</span>
              </button>
              <button
                id="tab-narrative"
                onClick={() => setActiveTab("narrative")}
                className={tabCls("narrative")}
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Contenuti Narrativi</span>
              </button>
            </>
          )}
          <button
            id="tab-badges"
            onClick={() => setActiveTab("badges")}
            className={tabCls("badges")}
          >
            <Trophy className="w-4 h-4 shrink-0" />
            <span>I Miei Badge</span>
          </button>
        </div>

        {/* Tab content */}
        <div className="p-5 flex-1">
          {currentTab === "missions" && renderMissions()}
          {currentTab === "shop" && renderShop()}
          {currentTab === "narrative" && renderNarrativeShop()}
          {currentTab === "badges" && renderMyBadges()}
        </div>

        {/* Reward toast inside modal (optional, mirrors the external one) */}
        {rewardToast && (
          <div className="sticky bottom-0 m-4 p-3 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-bold flex items-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{rewardToast}</span>
          </div>
        )}
      </div>
    </div>
  );
}
