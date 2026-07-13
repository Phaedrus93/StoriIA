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
} from "lucide-react";

interface BillingSummary {
  id: string;
  subscription_tier: "free" | "premium" | "family";
  subscription_status: string;
  credits_balance: number;
  addon_children_count: number;
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

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/family/check-child-limit");
      if (res.ok) {
        const data = await res.json();
        if (data.family) {
          setFamily(data.family);
        }
      }
      // Caricamento storico transazioni
      const ledgerRes = await fetch("/api/billing/ledger");
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

  const handleDowngrade = async (targetTier: "free" | "premium") => {
    if (!confirm(`Sei sicuro di voler effettuare il downgrade al piano ${targetTier.toUpperCase()}?`)) {
      return;
    }
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
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Sei sicuro di voler disdire il rinnovo automatico? L'abbonamento resterà comunque attivo fino a fine periodo.")) {
      return;
    }
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
    }
  };

  const handleReactivateSubscription = async () => {
    if (!confirm("Vuoi riattivare il rinnovo automatico del tuo abbonamento?")) {
      return;
    }
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
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigazione Back */}
        <div className="flex items-center justify-between">
          <Link
            href="/billing"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna a Piani & Ricariche
          </Link>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
            Gestione Abbonamento
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Amministra il tuo piano attivo, modifica il tier o consulta lo storico delle transazioni e dei crediti.
          </p>
        </div>

        {/* Banner Messaggi */}
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
              family?.subscription_status !== "canceling_at_period_end" && (
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
