"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CreditCard,
  Sparkles,
  Zap,
  Check,
  Clock,
  PlusCircle,
  AlertCircle,
  Users,
  Lock,
  ShoppingBag,
  Star,
} from "lucide-react";

interface LedgerEntry {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  created_at: string;
}

interface NarrativeItem {
  id: string;
  name: string;
  content_type: string;
  description: string;
  price_cents: number;
  icon_preset: string;
  isUnlocked: boolean;
  pack_id?: string;
}

function getCatalogIcon(preset: string): string {
  const icons: Record<string, string> = {
    snowflake: "❄️", flame: "🔥", cpu: "🤖", waves: "🌊",
    star: "⭐", trees: "🌲", castle: "🏰", anchor: "⚓",
    shield: "🛡️", search: "🔍", sparkles: "✨", rocket: "🚀",
    crown: "👑", star_frame: "⭐",
  };
  return icons[preset] || "🎁";
}

function BillingContent() {
  const searchParams = useSearchParams();
  const checkoutResult = searchParams.get("checkout");

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string>("free");
  const [status, setStatus] = useState<string>("active");
  const [creditsBalance, setCreditsBalance] = useState<number>(0);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [addonCount, setAddonCount] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<NarrativeItem[]>([]);
  const [catalogTab, setCatalogTab] = useState<"CHARACTER_TRAIT" | "SETTING_THEME" | "STORY_STYLE">("CHARACTER_TRAIT");

  useEffect(() => {
    loadBillingStatus();
    loadCatalog();
  }, []);

  async function loadBillingStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/family/billing-status");
      if (res.ok) {
        const data = await res.json();
        setTier(data.tier || "free");
        setStatus(data.status || "active");
        setCreditsBalance(data.creditsBalance || 0);
        setLedger(data.ledger || []);
      }
      const limitRes = await fetch("/api/family/check-child-limit");
      if (limitRes.ok) {
        const lim = await limitRes.json();
        setAddonCount(lim.addonCount || 0);
      }
    } catch { /* ignora */ }
    setLoading(false);
  }

  async function loadCatalog() {
    try {
      const res = await fetch("/api/family/unlocked-content");
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.all || []);
      }
    } catch { /* ignora */ }
  }

  const handleStripeCheckout = async (
    type: string,
    priceKey: string,
    extra?: Record<string, string | number>
  ) => {
    setActionLoading(`${type}_${priceKey}`);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, priceKey, ...extra }),
      });
      const data = await res.json();
      if (data.sandboxMode) {
        alert("Stripe Sandbox: configura le variabili STRIPE_PRICE_* in .env.local per attivare il checkout reale.\n\nPuoi usare le chiavi Stripe dalla Dashboard Sandbox.");
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      alert("Errore durante la creazione della sessione di pagamento.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlockNarrativeContent = async (item: NarrativeItem) => {
    setActionLoading(`content_${item.id}`);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "narrative_content", contentId: item.id }),
      });
      const data = await res.json();
      if (data.sandboxMode) {
        alert("Stripe Sandbox: configura STRIPE_PRICE_* in .env.local per attivare i pagamenti reali.");
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      alert("Errore pagamento.");
    } finally {
      setActionLoading(null);
    }
  };

  const catalogFiltered = catalog.filter((i) => i.content_type === catalogTab);

  const plans = [
    {
      key: "free",
      name: "Free",
      icon: null,
      price: "€0",
      period: "sempre",
      color: "indigo",
      features: [
        "1 profilo bambino",
        "5 crediti una tantum all'iscrizione",
        "Solo morali base gratuite",
        "Accesso a storie preset gratuite",
      ],
      priceKey: null,
    },
    {
      key: "premium",
      name: "Premium",
      icon: Sparkles,
      price: "€9.99",
      period: "mese",
      color: "indigo",
      features: [
        "Fino a 3 bambini",
        "30 crediti AI inclusi ogni mese",
        "Prezzo crediti extra scontato",
        "Tutte le morali sbloccate",
        "Accesso cosmetici Premium",
      ],
      priceKey: "premium_monthly",
      tier: "premium",
    },
    {
      key: "family",
      name: "Family",
      icon: Zap,
      price: "€16.99",
      period: "mese",
      color: "purple",
      features: [
        "Fino a 6 bambini",
        "80 crediti AI inclusi ogni mese",
        "Miglior prezzo credito extra",
        "Funzione regalo prioritaria",
        "Accesso cosmetici Family",
      ],
      priceKey: "family_monthly",
      tier: "family",
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      {/* Checkout feedback */}
      {checkoutResult === "success" && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3">
          <Check className="w-5 h-5 shrink-0" />
          <span><strong>Pagamento completato!</strong> Il tuo piano e i crediti sono stati aggiornati.</span>
        </div>
      )}
      {checkoutResult === "canceled" && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Pagamento annullato. Nessun addebito è stato effettuato.</span>
        </div>
      )}

      {/* Header */}
      <div>
        <Link href="/dashboard" className="inline-block text-xs font-semibold text-indigo-400 hover:text-indigo-300 mb-3">
          ← Torna alla Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-indigo-400" />
              <span>Abbonamento & Portafoglio</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Gestisci piano, crediti AI e contenuti sbloccabili
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/billing/manage"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition"
            >
              Gestisci Abbonamento →
            </Link>
            <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full uppercase tracking-wider">
              Stripe Sandbox
            </span>
          </div>
        </div>
      </div>

      {/* Avviso frozen */}
      {status === "frozen" && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>Abbonamento sospeso (Frozen):</strong>
            <p className="text-xs text-amber-200/90 mt-1">
              L&apos;ultimo pagamento non è andato a buon fine. La generazione storie è bloccata, ma tutti i tuoi dati e i profili bambino sono al sicuro.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass-card p-12 text-center text-slate-400 text-sm">Caricamento...</div>
      ) : (
        <div className="space-y-10">

          {/* Status bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="glass-card p-6">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Saldo Crediti</span>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-3xl font-extrabold text-white">{creditsBalance}</span>
                <span className="text-xs text-indigo-400 font-semibold">storie AI</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Nessuna scadenza
              </p>
            </div>

            <div className="glass-card p-6">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Piano Attuale</span>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xl font-bold text-white capitalize">{tier.toUpperCase()}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  status === "active" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                }`}>{status}</span>
              </div>
              {addonCount > 0 && (
                <p className="text-[11px] text-amber-300 mt-1">+{addonCount} slot bambino add-on</p>
              )}
            </div>

            <div className="glass-card p-6 border-indigo-500/30" id="addon">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pacchetti Crediti</span>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  disabled={!!actionLoading}
                  onClick={() => handleStripeCheckout("credit_pack", "credits_10", { creditsAmount: 10 })}
                  className="btn-primary text-xs py-2 px-3 flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  +10 (€4.99)
                </button>
                <button
                  type="button"
                  disabled={!!actionLoading}
                  onClick={() => handleStripeCheckout("credit_pack", "credits_25", { creditsAmount: 25 })}
                  className="btn-secondary text-xs py-2 px-3 flex items-center gap-1 border-indigo-500/40"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
                  +25 (€9.99)
                </button>
              </div>
            </div>
          </div>

          {/* Piani */}
          <div>
            <h2 className="text-lg font-bold text-white mb-4">Piani Abbonamento</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {plans.map((plan) => {
                const isActive = tier === plan.key;
                const Icon = plan.icon;
                return (
                  <div
                    key={plan.key}
                    className={`glass-card p-5 flex flex-col justify-between space-y-4 ${
                      isActive
                        ? plan.color === "purple" ? "border-purple-500/50" : "border-indigo-500/50"
                        : ""
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {Icon && <Icon className={`w-4 h-4 text-${plan.color}-400`} />}
                          <h3 className="text-base font-bold text-white">{plan.name}</h3>
                        </div>
                        {isActive && (
                          <span className={`text-[10px] bg-${plan.color}-500/20 text-${plan.color}-300 px-2 py-0.5 rounded-full font-bold`}>
                            ATTIVO
                          </span>
                        )}
                      </div>
                      <div className="mt-3 text-xl font-bold text-white">
                        {plan.price} <span className="text-xs text-slate-400">/ {plan.period}</span>
                      </div>
                      <ul className="space-y-2 text-xs text-slate-300 mt-3">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {!isActive && plan.priceKey && (
                      <button
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() => handleStripeCheckout("subscription", plan.priceKey!, { tier: plan.tier! })}
                        className={`btn-${plan.key === "premium" ? "primary" : "secondary"} text-xs w-full`}
                      >
                        {actionLoading === `subscription_${plan.priceKey}` ? "Reindirizzamento..." : `Attiva ${plan.name}`}
                      </button>
                    )}
                    {!isActive && !plan.priceKey && (
                      <span className="text-xs text-slate-500 text-center">Piano base</span>
                    )}
                  </div>
                );
              })}

              {/* Add-on */}
              <div className="glass-card p-5 flex flex-col justify-between space-y-4 border-dashed border-slate-700 bg-slate-900/40">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-amber-400" />
                      <h3 className="text-base font-bold text-amber-300">Add-on</h3>
                    </div>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">EXTRA</span>
                  </div>
                  <div className="mt-3 text-xl font-bold text-white">
                    +€1.99 <span className="text-xs text-slate-400">/ mese</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300 mt-3">
                    {[
                      "+1 profilo bambino su qualsiasi piano",
                      "Accesso completo alla libreria famiglia",
                      "Missioni e Punti Avventura indipendenti",
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {addonCount > 0 && (
                    <p className="text-xs text-amber-300 mt-2 font-semibold">{addonCount} slot già acquistati</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!!actionLoading}
                  onClick={() => handleStripeCheckout("addon_child", "addon_child")}
                  className="btn-secondary text-xs w-full text-amber-300 border-amber-500/40"
                >
                  {actionLoading === "addon_child_addon_child" ? "Reindirizzamento..." : "Aggiungi Slot (+€1.99/mese)"}
                </button>
              </div>
            </div>
          </div>

          {/* Catalogo Narrativo */}
          <div>
            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-400" />
              Negozio Contenuti Narrativi
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Sblocca tratti speciali, ambientazioni tematiche e stili narrativi per arricchire la creazione di storie.
              I contenuti sbloccati compaiono come opzioni extra nel wizard di creazione.
            </p>

            {/* Tab type filter */}
            <div className="flex gap-2 mb-4">
              {([
                { key: "CHARACTER_TRAIT", label: "Tratti Personaggio" },
                { key: "SETTING_THEME",   label: "Ambientazioni" },
                { key: "STORY_STYLE",     label: "Stili Storia" },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCatalogTab(tab.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    catalogTab === tab.key
                      ? "bg-indigo-500 text-white shadow-md"
                      : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogFiltered.map((item) => (
                <div
                  key={item.id}
                  className={`glass-card p-5 flex flex-col justify-between space-y-3 ${
                    item.isUnlocked ? "border-emerald-500/40 bg-emerald-500/5" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl">{getCatalogIcon(item.icon_preset)}</span>
                      {item.isUnlocked ? (
                        <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full shrink-0">
                          ✓ Sbloccato
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full shrink-0">
                          €{(item.price_cents / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white mt-2">{item.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.description}</p>
                  </div>
                  {item.isUnlocked ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                      <Star className="w-3.5 h-3.5" />
                      Disponibile nelle creazioni
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!!actionLoading}
                      onClick={() => handleUnlockNarrativeContent(item)}
                      className="btn-primary text-xs w-full flex items-center justify-center gap-1.5"
                    >
                      {actionLoading === `content_${item.id}` ? (
                        "Reindirizzamento..."
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          Sblocca — €{(item.price_cents / 100).toFixed(2)}
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}
              {catalogFiltered.length === 0 && (
                <div className="col-span-3 glass-card p-8 text-center text-slate-400 text-sm">
                  Nessun contenuto disponibile in questa categoria.
                </div>
              )}
            </div>
          </div>

          {/* Ledger */}
          <div>
            <h2 className="text-lg font-bold text-white mb-4">Registro Movimenti Crediti</h2>
            <div className="glass-card overflow-hidden">
              {ledger.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">Nessuna transazione registrata</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Data</th>
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4">Descrizione</th>
                        <th className="py-3 px-4 text-right">Variazione</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {ledger.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                            {new Date(entry.created_at).toLocaleString("it-IT")}
                          </td>
                          <td className="py-3 px-4 font-mono text-indigo-300">{entry.transaction_type}</td>
                          <td className="py-3 px-4">{entry.description}</td>
                          <td className={`py-3 px-4 text-right font-bold font-mono ${
                            entry.amount > 0 ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
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
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="glass-card p-12 text-center text-slate-400 text-sm">Caricamento...</div>}>
      <BillingContent />
    </Suspense>
  );
}
