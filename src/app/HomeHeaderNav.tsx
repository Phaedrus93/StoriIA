"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, LogOut } from "lucide-react";

interface HomeHeaderNavProps {
  isAuthenticated: boolean;
}

export default function HomeHeaderNav({ isAuthenticated }: HomeHeaderNavProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3">
      {isAuthenticated ? (
        <>
          <Link
            href="/dashboard"
            className="btn-primary text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-500/20"
          >
            <span>Vai alla Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Esci dall'account"
          >
            <LogOut className="w-4 h-4" />
            <span>Esci</span>
          </button>
        </>
      ) : (
        <>
          <Link
            href="/login"
            className="text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Accedi
          </Link>
          <Link
            href="/register"
            className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-xl transition-colors"
          >
            Crea Account Famiglia
          </Link>
        </>
      )}
    </div>
  );
}
