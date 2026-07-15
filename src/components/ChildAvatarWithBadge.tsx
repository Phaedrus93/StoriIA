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
  cosmeticsMap?: Record<string, string>; // id -> icon_preset
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
  const hasBadge = Boolean(activeBadgeId);

  const badgeIcon = hasBadge
    ? getCosmeticIcon(cosmeticsMap && activeBadgeId ? cosmeticsMap[activeBadgeId] : null)
    : null;

  return (
    <div
      className={`relative shrink-0 inline-flex ${
        hasFrame ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950 rounded-2xl" : ""
      } ${className}`}
    >
      <img
        src={getAvatarUrl(avatarPresetId)}
        alt={name}
        className={`${currentSize.img} bg-slate-900/80 border border-indigo-500/30 object-contain ${imgClassName}`}
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
