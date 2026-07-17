"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield, ArrowLeft, LogOut, Lock } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const supabase = createClient();

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    setChecking(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setErrorMsg("Devi effettuare l'accesso per visualizzare l'area amministratore.");
      setChecking(false);
      return;
    }

    // Effettua un controllo rapido con un endpoint admin in sola lettura
    const res = await fetch("/api/admin/subscription-plans");
    if (res.ok) {
      setAuthorized(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error || "Accesso negato. Non disponi dei privilegi di amministratore.");
      setAuthorized(false);
    }
    setChecking(false);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-sm text-slate-400 font-medium">Verifica privilegi amministrativi...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="glass-card max-w-md w-full p-8 text-center border-rose-500/30">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <Lock className="w-8 h-8 text-rose-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Accesso Negato (403)</h1>
          <p className="text-sm text-slate-300 mb-6">{errorMsg}</p>
          <div className="flex flex-col gap-3">
            <Link
              href="/dashboard"
              className="btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Torna in Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="btn-secondary py-2 text-xs flex items-center justify-center gap-2 text-slate-400"
            >
              <LogOut className="w-3.5 h-3.5" />
              Esci
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Admin Topbar */}
      <header className="border-b border-indigo-500/20 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                StoriIA <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-600 text-white uppercase font-black tracking-wider">Admin Hub</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              App Genitore
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 p-1.5"
              title="Disconnettiti"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
