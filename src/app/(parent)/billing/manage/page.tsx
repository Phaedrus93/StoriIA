"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard,
  ArrowLeft,
  ShieldAlert,
  ArrowDownCircle,
  Calendar,
  History,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Users,
  MinusCircle,
} from "lucide-react";
import ConfirmationModal from "@/components/ConfirmationModal";

interface BillingSummary {
  id: string;
  subscription_tier: "free" | "premium" | "family";
  subscription_status: string;
  credits_balance: number;
  addon_children_count: number;
  pending_addon_children_count?: number | null;
  stripe_subscription_id?: string | null;
}

interface LedgerEntry {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  created_at: string;
}

export default function ManageBillingPage() {
  const [family, setFamily] = useState<BillingSummary | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: "danger" | "warning" | "info";
    onConfirm: () => Promise<void>;
  }>({
    title: "",
    message: "",
    confirmLabel: "Conferma",
    variant: "warning",
    onConfirm: async () => {},
  });

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const statusRes = await fetch("/api/family/billing-status", { cache: "no-store" });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.family) {
          setFamily(statusData.family);
        } else {
          setFamily({
            id: "",
            subscription_tier: statusData.tier || "free",
            subscription_status: statusData.status || "active",
            credits_balance: statusData.creditsBalance || 0,
            addon_children_count: statusData.addonCount || 0,
            pending_addon_children_count: statusData.pendingAddonCount ?? null,
            stripe_subscription_id: statusData.stripeSubscriptionId || null,
          });
        }
        if (statusData.ledger) {
          setLedger(statusData.ledger);
        }
      }
      const ledgerRes = await fetch("/api/billing/ledger", { cache: "no-store" });
      if (ledgerRes.ok) {
        const ledgerData = await ledgerRes.json();
        setLedger(ledgerData.entries || []);
      }
    } catch {
      setErrorMsg("Impossibile caricare i dati dell'abbonamento.");
    } finally {
      setLoading(false);
    }
  };

  const executeDowngrade = async (targetTier: "free" | "premium") => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/family/downgrade-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTier }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Errore durante il downgrade");
      } else {
        setSuccessMsg(`Downgrade a ${targetTier.toUpperCase()} completato con successo.`);
        fetchBillingData();
      }
    } catch {
      setErrorMsg("Errore di connessione durante il downgrade.");
    } finally {
      setActionLoading(false);
      setModalOpen(false);
    }
  };

  const handleDowngrade = (targetTier: "free" | "premium") => {
    setModalConfig({
      title: "Conferma Downgrade Piano",
      message: `Sei sicuro di voler effettuare il downgrade al piano ${targetTier.toUpperCase()}?\nSe il nuovo piano supporta meno profili bambino, quelli in eccedenza verranno temporaneamente disattivati.`,
      confirmLabel: `Conferma Downgrade a ${targetTier.toUpperCase()}`,
      variant: "warning",
      onConfirm: () => executeDowngrade(targetTier),
    });
    setModalOpen(true);
  };

  const executeCancelSubscription = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/billing/cancel-subscription", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Impossibile annullare l'abbonamento");
      } else {
        setSuccessMsg(data.message || "Rinnovo disattivato. L'abbonamento resta attivo fino a fine periodo.");
        fetchBillingData();
      }
    } catch {
      setErrorMsg("Errore di rete durante la disdetta.");
    } finally {
      setActionLoading(false);
      setModalOpen(false);
    }
  };

  const handleCancelSubscription = () => {
    setModalConfig({
      title: "Disdetta Rinnovo Automatico",
      message: "Sei sicuro di voler disdire il rinnovo automatico? L'abbonamento e i tuoi crediti resteranno pienamente attivi fino a fine periodo, dopodiché passerai al piano Free.",
      confirmLabel: "Conferma Disdetta",
      variant: "danger",
      onConfirm: executeCancelSubscription,
    });
    setModalOpen(true);
  };

  const executeReactivateSubscription = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/billing/reactivate-subscription", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Impossibile riattivare l'abbonamento");
      } else {
        setSuccessMsg(data.message || "Il rinnovo automatico è stato riattivato con successo.");
        fetchBillingData();
      }
    } catch {
      setErrorMsg("Errore di rete durante la riattivazione.");
    } finally {
      setActionLoading(false);
      setModalOpen(false);
    }
  };

  const handleReactivateSubscription = () => {
    setModalConfig({
      title: "Riattivazione Abbonamento",
      message: "Vuoi riattivare il rinnovo automatico del tuo abbonamento per continuare senza interruzioni?",
      confirmLabel: "Conferma Riattivazione",
      variant: "info",
      onConfirm: executeReactivateSubscription,
    });
    setModalOpen(true);
  };

  const executeReduceAddon = async (targetCount: number) => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/billing/reduce-addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAddonCount: targetCount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Impossibile pianificare la riduzione degli add-on");
      } else {
        setSuccessMsg(data.message || `Riduzione pianificata a ${targetCount} add-on al prossimo rinnovo.`);
        fetchBillingData();
      }
    } catch {
      setErrorMsg("Errore di connessione durante la riduzione add-on.");
    } finally {
      setActionLoading(false);
      setModalOpen(false);
    }
  };

  const handleReduceAddon = (targetCount: number) => {
    setModalConfig({
      title: "Riduzione Add-On Profili",
      message: `Vuoi pianificare la riduzione a ${targetCount} add-on profili bambino?\nLa modifica avrà effetto dal prossimo rinnovo della fattura, senza addebiti immediati.`,
      confirmLabel: `Riduci a ${targetCount} add-on`,
      variant: "warning",
      onConfirm: () => executeReduceAddon(targetCount),
    });
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  const currentAddons = family?.addon_children_count || 0;
  const pendingAddons = family?.pending_addon_children_count;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12">
      <ConfirmationModal
        isOpen={modalOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmLabel={modalConfig.confirmLabel}
        variant={modalConfig.variant}
        isLoading={actionLoading}
        onConfirm={modalConfig.onConfirm}
        onClose={() => setModalOpen(false)}
      />

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/billing"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Gestione Abbonamento & Piano
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Pianifica modifiche, gestisci i tuoi profili aggiuntivi e controlla il rinnovo.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-400" />
            <span className="text-sm">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />
            <span className="text-sm">{successMsg}</span>
          </div>
        )}

        {/* Card Stato Piano Attuale */}
        <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400">
                  Piano Attuale
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    family?.subscription_status === "canceling_at_period_end"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {family?.subscription_status === "canceling_at_period_end"
                    ? "Cancellazione a fine periodo"
                    : "Attivo"}
                </span>
              </div>
              <h2 className="text-2xl font-bold uppercase mt-1">
                {family?.subscription_tier || "free"}
              </h2>
            </div>

            <div className="flex items-center gap-3 bg-slate-800/60 px-4 py-2.5 rounded-xl border border-slate-700/60">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <div>
                <div className="text-xs text-slate-400">Crediti AI Disponibili</div>
                <div className="text-lg font-bold text-amber-300">
                  {family?.credits_balance ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Add-on Profili */}
          {currentAddons > 0 && (
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-indigo-400" />
                <div>
                  <div className="text-sm font-bold text-white">
                    Add-on Profili Bambino Attivi: {currentAddons}
                  </div>
                  {pendingAddons !== null && pendingAddons !== undefined ? (
                    <div className="text-xs text-amber-300 font-semibold mt-0.5">
                      da: {currentAddons}, a partire dal prossimo rinnovo: {pendingAddons}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 mt-0.5">
                      Estensione per aggiungere più bambini al tuo account.
                    </div>
                  )}
                </div>
              </div>
              {(pendingAddons === null || pendingAddons === undefined || pendingAddons > 0) && currentAddons > 0 && (
                <button
                  onClick={() => handleReduceAddon(Math.max(0, (pendingAddons ?? currentAddons) - 1))}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                >
                  <MinusCircle className="h-4 w-4 text-amber-400" />
                  Riduci di 1 Add-on (dal rinnovo)
                </button>
              )}
            </div>
          )}

          {/* Azioni del Piano */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3">
            {family?.subscription_tier === "family" && (
              <button
                onClick={() => handleDowngrade("premium")}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition disabled:opacity-50"
              >
                <ArrowDownCircle className="h-4 w-4 text-indigo-400" />
                Downgrade a Premium
              </button>
            )}

            {family?.subscription_tier !== "free" && (
              <button
                onClick={() => handleDowngrade("free")}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition disabled:opacity-50"
              >
                <ArrowDownCircle className="h-4 w-4 text-slate-400" />
                Passa a Free
              </button>
            )}

            {family?.subscription_tier !== "free" &&
              Boolean(family?.stripe_subscription_id) &&
              ["active", "trialing"].includes(family?.subscription_status || "") && (
                <button
                  onClick={handleCancelSubscription}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-sm font-medium border border-rose-500/30 transition disabled:opacity-50"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Annulla Abbonamento (a fine periodo)
                </button>
              )}

            {family?.subscription_status === "canceling_at_period_end" && (
              <button
                onClick={handleReactivateSubscription}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-sm font-medium border border-emerald-500/30 transition disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Riattiva Abbonamento
              </button>
            )}
          </div>
        </div>

        {/* Storico Pagamenti / Movimenti */}
        <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-400" />
            <h3 className="text-lg font-semibold">Storico Transazioni & Crediti</h3>
          </div>

          {ledger.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">
              Nessuna transazione registrata nello storico.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Descrizione</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4 text-right">Variazione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {ledger.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {item.description}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700">
                          {item.transaction_type}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold ${
                          item.amount > 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {item.amount > 0 ? `+${item.amount}` : item.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
