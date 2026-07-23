"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Users,
  Sparkles,
  Library,
  LogOut,
  ShieldAlert,
  UserCog,
  Compass,
  LayoutDashboard,
  Crown,
  Book,
  Rocket,
  Star,
} from "lucide-react";

interface ParentProfileData {
  parent_display_name?: string;
  parent_role?: string;
  preset?: {
    name: string;
    image_url: string;
  } | null;
  badge?: {
    name: string;
    icon_preset: string;
  } | null;
  frame?: {
    name: string;
    icon_preset: string;
  } | null;
}

interface ParentSidebarProps {
  hasPinConfigured: boolean | null;
  onLogout: () => void;
}

export default function ParentSidebar({
  hasPinConfigured,
  onLogout,
}: ParentSidebarProps) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<ParentProfileData | null>(null);

  useEffect(() => {
    fetchParentProfile();
  }, [pathname]);

  async function fetchParentProfile() {
    try {
      const res = await fetch("/api/family/profile", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
        }
      }
    } catch {
      // ignore silently
    }
  }

  const renderBadgeIcon = (iconPreset?: string) => {
    if (!iconPreset) return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
    switch (iconPreset) {
      case "crown":
        return <Crown className="w-3.5 h-3.5 text-amber-400" />;
      case "book":
        return <Book className="w-3.5 h-3.5 text-indigo-400" />;
      case "rocket":
        return <Rocket className="w-3.5 h-3.5 text-pink-400" />;
      default:
        return <Star className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const navSection1 = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Profili Figli", href: "/children", icon: Users },
    { name: "Le Mie Storie", href: "/stories", icon: BookOpen },
  ];

  const navSection2 = [
    {
      name: "+ Nuova Storia AI",
      href: "/stories/new",
      icon: Sparkles,
      highlight: true,
    },
    { name: "Personaggi", href: "/library/characters", icon: Users },
    { name: "Ambientazioni", href: "/library/settings", icon: Compass },
  ];

  return (
    <aside className="hidden md:flex w-64 shrink-0 border-r border-slate-800/80 bg-slate-900/90 backdrop-blur-2xl flex-col justify-between sticky top-0 h-screen z-40 select-none">
      {/* Header / Logo */}
      <div className="p-5 border-b border-slate-800/60 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 font-extrabold text-xl tracking-tight text-white hover:opacity-95 transition-opacity"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span>
            Stori<span className="text-indigo-400">IA</span>
          </span>
        </Link>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
          v2
        </span>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-6 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Famiglia & Lettura
          </div>
          <nav className="space-y-1">
            {navSection1.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-3 ${
                    active
                      ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm font-semibold"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      active ? "text-indigo-400" : "text-slate-400"
                    }`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          <div className="px-3 mb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Libreria Creativa
          </div>
          <nav className="space-y-1.5">
            {navSection2.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              if (item.highlight) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3.5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 shadow-md ${
                      active
                        ? "bg-gradient-to-r from-amber-500 to-indigo-600 text-white ring-2 ring-amber-400/40"
                        : "bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-pink-500/15 border border-amber-500/30 text-amber-300 hover:from-amber-500/25 hover:to-indigo-500/25 hover:text-white"
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
                      <Icon className="w-4 h-4 animate-pulse" />
                    </div>
                    <span>{item.name}</span>
                  </Link>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-3 ${
                    active
                      ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm font-semibold"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      active ? "text-indigo-400" : "text-slate-400"
                    }`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer / Profilo Guida Genitore */}
      <div className="p-3 border-t border-slate-800/60 bg-slate-900/40 space-y-3">
        <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center gap-3">
          {/* Avatar / Icona Genitore */}
          <div className="relative shrink-0">
            {profile?.preset ? (
              <img
                src={profile.preset.image_url}
                alt={profile.preset.name}
                className="w-10 h-10 rounded-xl object-cover border border-indigo-500/30 bg-slate-800"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-700 to-indigo-900 flex items-center justify-center border border-slate-600 text-white font-bold text-sm">
                👤
              </div>
            )}
            {profile?.badge && (
              <div
                className="absolute -bottom-1 -right-1 p-1 rounded-full bg-slate-900 border border-amber-500/40 shadow"
                title={profile.badge.name}
              >
                {renderBadgeIcon(profile.badge.icon_preset)}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate">
              {profile?.parent_display_name || "Genitore StoriIA"}
            </div>
            <div className="text-[11px] text-indigo-300 font-medium truncate flex items-center gap-1">
              <span>{profile?.parent_role || "Guida Famiglia"}</span>
            </div>
          </div>

          <Link
            href="/settings"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            title="Impostazioni Profilo Genitore"
          >
            <UserCog className="w-4 h-4" />
          </Link>
        </div>

        {/* Azioni rapide footer */}
        <div className="grid grid-cols-2 gap-2">
          {hasPinConfigured === false ? (
            <button
              disabled
              title="Configura prima il PIN di sicurezza"
              className="px-2.5 py-2 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] font-semibold text-slate-500 opacity-50 cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="truncate">Modalità Bambino</span>
            </button>
          ) : (
            <Link
              href="/child-select"
              className="px-2.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-[11px] font-bold text-indigo-300 transition-all flex items-center justify-center gap-1.5"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
              <span className="truncate">Area Bambino</span>
            </Link>
          )}

          <button
            onClick={onLogout}
            className="px-2.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-[11px] font-bold text-rose-300 transition-all flex items-center justify-center gap-1.5"
            title="Esci dall'account"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="truncate">Esci</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
