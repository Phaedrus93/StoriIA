"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Sparkles,
  Users,
  UserCog,
} from "lucide-react";

export default function ParentBottomNav() {
  const pathname = usePathname();

  const tabs = [
    { name: "Home", href: "/dashboard", icon: LayoutDashboard },
    { name: "Storie", href: "/stories", icon: BookOpen },
    {
      name: "+ AI",
      href: "/stories/new",
      icon: Sparkles,
      isPrimary: true,
    },
    { name: "Libreria", href: "/library", icon: Users },
    { name: "Profilo", href: "/settings", icon: UserCog },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-900/95 backdrop-blur-2xl border-t border-slate-800/90 shadow-2xl pb-[env(safe-area-inset-bottom)] select-none">
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active =
            pathname === tab.href ||
            (tab.href !== "/dashboard" && pathname.startsWith(tab.href));

          if (tab.isPrimary) {
            return (
              <div
                key={tab.href}
                className="flex flex-col items-center justify-center -mt-5"
              >
                <Link
                  href={tab.href}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all transform active:scale-95 ${
                    active
                      ? "bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-500 text-white ring-4 ring-slate-900 scale-105"
                      : "bg-gradient-to-tr from-amber-500 to-indigo-600 text-white border-2 border-slate-900 hover:scale-105 shadow-indigo-500/30"
                  }`}
                  title="Crea Nuova Storia Magica AI"
                >
                  <Icon className="w-6 h-6 animate-pulse" />
                </Link>
                <span className="text-[11px] font-extrabold text-amber-300 mt-1">
                  {tab.name}
                </span>
              </div>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1 h-full min-h-[44px] transition-colors rounded-xl ${
                active
                  ? "text-indigo-400 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon
                className={`w-5 h-5 ${
                  active ? "text-indigo-400 scale-110" : "text-slate-400"
                } transition-transform`}
              />
              <span className="text-[11px] tracking-tight truncate">
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
