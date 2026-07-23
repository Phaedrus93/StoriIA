"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  ShieldAlert,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { hashPinAction } from "@/app/actions/pin";
import NotificationBell from "@/components/parent/NotificationBell";
import ParentSidebar from "@/components/parent/ParentSidebar";
import ParentBottomNav from "@/components/parent/ParentBottomNav";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [hasPinConfigured, setHasPinConfigured] = useState<boolean | null>(null);
  const [showPinWizard, setShowPinWizard] = useState(false);
  const [wizardPin, setWizardPin] = useState("");
  const [wizardConfirmPin, setWizardConfirmPin] = useState("");
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardLoading, setWizardLoading] = useState(false);

  // Stato e controllo per la scelta obbligatoria profili al termine abbonamento o superamento limite
  const [limitCheckInfo, setLimitCheckInfo] = useState<{
    requiresSelection: boolean;
    activeCount: number;
    maxAllowed: number;
    tier: string;
    activeChildren: Array<{ id: string; name: string; gender?: string; avatar_preset_id?: string }>;
  } | null>(null);
  const [selectedKeepIds, setSelectedKeepIds] = useState<string[]>([]);
  const [enforcingLimit, setEnforcingLimit] = useState(false);
  const [enforceError, setEnforceError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    checkPinSecurity();
    checkChildLimits();
  }, [pathname]);

  async function checkChildLimits() {
    try {
      const res = await fetch("/api/family/limit-check", { cache: "no-store" });
      if (res.ok) {
        const info = await res.json();
        setLimitCheckInfo(info);
        if (info.requiresSelection && info.activeChildren) {
          // Preseleziona fino a maxAllowed come suggerimento iniziale
          setSelectedKeepIds(info.activeChildren.slice(0, info.maxAllowed).map((c: { id: string }) => c.id));
        }
      }
    } catch {
      // ignora errore di rete silently
    }
  }

  const handleConfirmLimitSelection = async () => {
    if (!limitCheckInfo) return;
    if (selectedKeepIds.length !== limitCheckInfo.maxAllowed) {
      setEnforceError(`Devi selezionare esattamente ${limitCheckInfo.maxAllowed} ${limitCheckInfo.maxAllowed === 1 ? 'profilo' : 'profili'} per confermare.`);
      return;
    }
    setEnforcingLimit(true);
    setEnforceError(null);
    try {
      const res = await fetch("/api/family/enforce-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepChildIds: selectedKeepIds }),
      });
      const data = await res.json();
      if (res.ok) {
        await checkChildLimits();
        if (pathname === "/children") {
          window.location.reload();
        }
      } else {
        setEnforceError(data.error || "Errore durante la conferma");
      }
    } catch {
      setEnforceError("Errore di rete durante la conferma della selezione");
    } finally {
      setEnforcingLimit(false);
    }
  };

  const handleToggleKeepChild = (id: string) => {
    if (!limitCheckInfo) return;
    if (selectedKeepIds.includes(id)) {
      setSelectedKeepIds(selectedKeepIds.filter((item) => item !== id));
    } else {
      if (selectedKeepIds.length < limitCheckInfo.maxAllowed) {
        setSelectedKeepIds([...selectedKeepIds, id]);
      }
    }
  };

  async function checkPinSecurity() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    let { data: fam } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (!fam) {
      // Garanzia auto-creazione / Account Linking per login social se non ancora creata:
      await supabase
        .from("families")
        .upsert(
          { parent_user_id: user.id },
          { onConflict: "parent_user_id", ignoreDuplicates: true }
        );

      const { data: newFam } = await supabase
        .from("families")
        .select("id")
        .eq("parent_user_id", user.id)
        .single();

      fam = newFam;
    }

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
        await supabase
          .from("families")
          .upsert(
            { parent_user_id: user.id },
            { onConflict: "parent_user_id", ignoreDuplicates: true }
          );

        const { data: createdFam } = await supabase
          .from("families")
          .select("id")
          .eq("parent_user_id", user.id)
          .single();

        fam = createdFam;
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

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 relative selection:bg-indigo-500 selection:text-white">
      {/* Sidebar Desktop */}
      <ParentSidebar hasPinConfigured={hasPinConfigured} onLogout={handleLogout} />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top App Bar per Mobile PWA */}
        <header className="md:hidden sticky top-0 z-40 h-14 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 px-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-extrabold text-lg tracking-tight text-white">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span>Stori<span className="text-indigo-400">IA</span></span>
          </Link>

          <div className="flex items-center gap-2">
            <NotificationBell />
            {hasPinConfigured === false ? (
              <button
                disabled
                title="Configura prima il PIN di sicurezza"
                className="p-1.5 rounded-xl border border-slate-800 text-slate-500 opacity-50 cursor-not-allowed"
              >
                <ShieldAlert className="w-4 h-4" />
              </button>
            ) : (
              <Link
                href="/child-select"
                title="Area Bambino"
                className="p-1.5 rounded-xl border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
              >
                <ShieldAlert className="w-4 h-4" />
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-8">
          {children}
        </main>
      </div>

      {/* Floating Bottom Nav PWA */}
      <ParentBottomNav />

      {/* Modale Bloccante Obbligatorio per Selezione Profili al superamento limite o termine abbonamento */}
      {limitCheckInfo?.requiresSelection && !pathname.startsWith("/billing") && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in">
          <div className="glass-card max-w-lg w-full p-6 md:p-8 border-amber-500/40 bg-slate-900 shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white">
                  Scelta Obbligatoria Profili
                </h2>
                <p className="text-xs text-amber-300 font-medium">
                  Abbonamento terminato o piano {limitCheckInfo.tier.toUpperCase()} superato
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Il tuo piano consente un massimo di <strong className="text-white font-bold">{limitCheckInfo.maxAllowed} {limitCheckInfo.maxAllowed === 1 ? 'profilo attivo' : 'profili attivi'}</strong>, ma attualmente ne hai <strong className="text-white font-bold">{limitCheckInfo.activeCount}</strong>.
              <br /><br />
              Seleziona {limitCheckInfo.maxAllowed === 1 ? "l'unico profilo" : `i ${limitCheckInfo.maxAllowed} profili`} da mantenere {limitCheckInfo.maxAllowed === 1 ? 'attivo' : 'attivi'}. Tutti gli altri verranno sospesi e conservati al sicuro. Finché non confermi la scelta o non estendi il piano, l'applicazione non è utilizzabile.
            </p>

            {enforceError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {enforceError}
              </div>
            )}

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {limitCheckInfo.activeChildren.map((child) => {
                const isChecked = selectedKeepIds.includes(child.id);
                return (
                  <div
                    key={child.id}
                    onClick={() => handleToggleKeepChild(child.id)}
                    className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isChecked
                        ? "bg-indigo-500/20 border-indigo-500/50 text-white shadow-md"
                        : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${isChecked ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-slate-600 bg-slate-800'}`}>
                        {isChecked && <span className="text-xs font-bold">✓</span>}
                      </div>
                      <div>
                        <div className={`font-bold text-sm ${isChecked ? 'text-white' : 'text-slate-300'}`}>{child.name}</div>
                        <div className="text-xs text-slate-400">
                          {child.gender === "boy" ? "👦 Maschio" : child.gender === "girl" ? "👧 Femmina" : "🧒 Neutro"}
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                      isChecked ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {isChecked ? "Da Mantenere" : "Verrà Sospeso"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 space-y-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleConfirmLimitSelection}
                disabled={enforcingLimit || selectedKeepIds.length !== limitCheckInfo.maxAllowed}
                className="btn-primary w-full py-3 bg-gradient-to-r from-amber-500 to-indigo-500 hover:opacity-95 font-bold text-sm"
              >
                {enforcingLimit
                  ? "Applicazione in corso..."
                  : `Conferma Scelta e Sospendi gli altri (${selectedKeepIds.length}/${limitCheckInfo.maxAllowed})`}
              </button>

              <button
                type="button"
                onClick={() => router.push("/billing")}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-300 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Rinnova o Estendi Abbonamento ({limitCheckInfo.tier.toUpperCase()})</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
