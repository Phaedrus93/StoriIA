"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  Users,
  Sparkles,
  Library,
  LogOut,
  ShieldAlert,
  UserCog,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { hashPinAction } from "@/app/actions/pin";
import NotificationBell from "@/components/parent/NotificationBell";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [hasPinConfigured, setHasPinConfigured] = useState<boolean | null>(null);
  const [showPinWizard, setShowPinWizard] = useState(false);
  const [wizardPin, setWizardPin] = useState("");
  const [wizardConfirmPin, setWizardConfirmPin] = useState("");
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardLoading, setWizardLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    checkPinSecurity();
  }, []);

  async function checkPinSecurity() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: fam } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (fam) {
      const { data: statusRows } = await supabase.rpc("get_lockout_status", {
        p_family_id: fam.id,
      });

      const row = statusRows && statusRows.length > 0 ? statusRows[0] : null;
      if (!row || !row.pin_hash) {
        setHasPinConfigured(false);
        setShowPinWizard(true);
      } else {
        setHasPinConfigured(true);
        setShowPinWizard(false);
      }
    }
  }

  const handleCreatePinWizard = async (e: React.FormEvent) => {
    e.preventDefault();
    setWizardError(null);

    if (!/^\d{4,6}$/.test(wizardPin)) {
      setWizardError("Il PIN deve essere composto da 4 a 6 cifre numeriche.");
      return;
    }

    if (wizardPin !== wizardConfirmPin) {
      setWizardError("I due PIN inseriti non coincidono.");
      return;
    }

    setWizardLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      let { data: fam } = await supabase
        .from("families")
        .select("id")
        .eq("parent_user_id", user.id)
        .single();

      if (!fam) {
        const { data: fallbackFam } = await supabase
          .from("families")
          .select("id")
          .single();
        fam = fallbackFam;
      }

      if (!fam) throw new Error("Famiglia non trovata per l'utente.");

      const hash = await hashPinAction(wizardPin);

      const { error: rpcErr } = await supabase.rpc("set_parent_pin_hash", {
        p_family_id: fam.id,
        p_pin_hash: hash,
      });

      if (rpcErr) {
        throw new Error(rpcErr.message || "Impossibile salvare il PIN nel database.");
      }

      setHasPinConfigured(true);
      setShowPinWizard(false);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Errore durante la creazione del PIN.";
      setWizardError(msg);
    } finally {
      setWizardLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: BookOpen },
    { name: "Profili Figli", href: "/children", icon: Users },
    { name: "Personaggi", href: "/library/characters", icon: Sparkles },
    { name: "Ambientazioni", href: "/library/settings", icon: Library },
    { name: "Storie AI", href: "/stories", icon: BookOpen },
    { name: "Impostazioni", href: "/settings", icon: UserCog },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 relative">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-900/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl tracking-tight">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center shadow-md">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span>Stori<span className="text-indigo-400">IA</span></span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                      active
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />

            {hasPinConfigured === false ? (
              <button
                disabled
                title="Configura prima il PIN di sicurezza"
                className="btn-secondary text-xs !py-1.5 !px-3 border-slate-800 text-slate-500 opacity-50 cursor-not-allowed flex items-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Modalità Bambino</span>
              </button>
            ) : (
              <Link
                href="/child-select"
                className="btn-secondary text-xs !py-1.5 !px-3 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 flex items-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Modalità Bambino</span>
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Esci dall'account"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Wizard Obbligatorio Primo Accesso per Configurazione PIN */}
      {showPinWizard && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-card p-8 border-indigo-500/40 shadow-2xl space-y-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <KeyRound className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-extrabold text-white">
                Imposta il tuo PIN Genitore
              </h2>
              <p className="text-xs text-slate-300">
                Prima di iniziare, crea un PIN numerico da 4 a 6 cifre. Ti servirà per uscire dalla Modalità Bambino in tutta sicurezza.
              </p>
            </div>

            {wizardError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
                {wizardError}
              </div>
            )}

            <form onSubmit={handleCreatePinWizard} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nuovo PIN (4-6 Cifre)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  maxLength={6}
                  placeholder="••••"
                  value={wizardPin}
                  onChange={(e) => setWizardPin(e.target.value)}
                  className="input-field text-center text-lg tracking-widest font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Conferma PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  maxLength={6}
                  placeholder="••••"
                  value={wizardConfirmPin}
                  onChange={(e) => setWizardConfirmPin(e.target.value)}
                  className="input-field text-center text-lg tracking-widest font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={wizardLoading}
                className="btn-primary w-full mt-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{wizardLoading ? "Salvataggio..." : "Salva PIN e Inizia"}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
