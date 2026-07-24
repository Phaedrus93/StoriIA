"use client";

import React from "react";
import { getAvatarUrl } from "@/lib/avatars";

export function getCosmeticIcon(preset?: string | null): string {
  if (!preset) return "🏆";
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
  return icons[preset] || "🏆";
}

interface ChildAvatarWithBadgeProps {
  name: string;
  avatarPresetId?: string | null;
  activeBadgeId?: string | null;
  activeFrameId?: string | null;
  cosmeticsMap?: Record<string, any>; // id -> cosmetic object
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  imgClassName?: string;
}

export function ChildAvatarWithBadge({
  name,
  avatarPresetId,
  activeBadgeId,
  activeFrameId,
  cosmeticsMap,
  size = "md",
  className = "",
  imgClassName = "",
}: ChildAvatarWithBadgeProps) {
  const sizeClasses: Record<string, { img: string; badge: string }> = {
    sm: { img: "w-10 h-10 rounded-xl p-1", badge: "w-4 h-4 text-[9px] -bottom-1 -right-1" },
    md: { img: "w-14 h-14 rounded-2xl p-1", badge: "w-5 h-5 text-[11px] -bottom-1 -right-1" },
    lg: { img: "w-16 h-16 rounded-2xl p-1.5", badge: "w-6 h-6 text-xs -bottom-1 -right-1" },
    xl: { img: "w-20 h-20 rounded-3xl p-2", badge: "w-7 h-7 text-sm -bottom-1.5 -right-1.5" },
  };

  const currentSize = sizeClasses[size] || sizeClasses.md;
  const hasFrame = Boolean(activeFrameId);
  const frameData = hasFrame && cosmeticsMap && activeFrameId ? cosmeticsMap[activeFrameId] : null;
  let frameEffect = frameData?.frame_effect || "solid";
  if (frameEffect === "sparkle") frameEffect = "sparkling";
  const frameColor = frameData?.frame_color || "#f59e0b";
  const roundingClass = size === "xl" ? "rounded-3xl" : "rounded-2xl";
  const hasBadge = Boolean(activeBadgeId);

  const badgeIcon = hasBadge
    ? getCosmeticIcon(cosmeticsMap && activeBadgeId ? (cosmeticsMap[activeBadgeId]?.icon_preset || cosmeticsMap[activeBadgeId]) : null)
    : null;

  return (
    <div className={`relative shrink-0 inline-flex ${roundingClass} ${className}`}>
      {hasFrame && (
        <div 
          className={`absolute inset-0 pointer-events-none z-0 ${roundingClass} frame-effect-${frameEffect}`}
          style={{ "--frame-color": frameColor } as React.CSSProperties}
        >
          {frameEffect === "sparkling" && (
            <svg className="absolute inset-0 w-full h-full overflow-visible">
               <rect 
                 x="-2" y="-2" 
                 style={{ width: "calc(100% + 4px)", height: "calc(100% + 4px)" }}
                 rx={size === "xl" ? "26" : "18"} 
                 fill="none" 
                 stroke="var(--frame-color)" 
                 strokeWidth="3" 
                 strokeDasharray="4 8"
                 strokeLinecap="round"
                 className="animate-sparkling-ants"
               />
            </svg>
          )}
        </div>
      )}

      <img
        src={getAvatarUrl(avatarPresetId)}
        alt={name}
        className={`relative z-10 ${currentSize.img} bg-slate-900/80 border border-indigo-500/30 object-contain ${imgClassName}`}
      />
      {hasBadge && badgeIcon && (
        <span
          className={`absolute ${currentSize.badge} bg-gradient-to-r from-amber-500 to-indigo-600 border border-amber-300 rounded-full flex items-center justify-center shadow-lg select-none z-10 font-bold transform scale-105`}
          title="Badge Equipaggiato"
        >
          {badgeIcon}
        </span>
      )}
    </div>
  );
}
