"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Gift, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function GiftHistoryPage() {
  const [purchased, setPurchased] = useState<any[]>([]);
  const [redeemed, setRedeemed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/gift-codes", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPurchased(data.purchasedCodes || []);
      setRedeemed(data.redeemedCodes || []);
    } catch {
      setErrorMsg("Impossibile caricare lo storico dei regali.");
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/billing/manage"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Storico Regali</h1>
            <p className="text-sm text-slate-400 mt-1">Consulta i regali acquistati e quelli che hai ricevuto.</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-400" />
            <span className="text-sm">{errorMsg}</span>
          </div>
        )}

        <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Gift className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold">Regali Acquistati</h2>
          </div>
          {purchased.length === 0 ? (
            <p className="text-slate-400 text-sm">Non hai ancora acquistato codici regalo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Codice</th>
                    <th className="py-3 px-4">Entità</th>
                    <th className="py-3 px-4">Acquistato il</th>
                    <th className="py-3 px-4">Stato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {purchased.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-300">{p.code}</td>
                      <td className="py-3 px-4">
                        {p.type === "credits" ? `${p.amount_or_tier} Crediti AI` : `Abbonamento ${p.amount_or_tier.toUpperCase()}`}
                      </td>
                      <td className="py-3 px-4">{new Date(p.created_at).toLocaleDateString("it-IT")}</td>
                      <td className="py-3 px-4">
                        {p.status === "active" ? (
                          <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">DA RISCATTARE</span>
                        ) : p.status === "redeemed" ? (
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400 border border-slate-700">RISCATTATO</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">IN ELABORAZIONE</span>
                        )}
                        {p.status === "redeemed" && p.redeemed_at && (
                          <div className="text-[10px] text-slate-500 mt-1">il {new Date(p.redeemed_at).toLocaleDateString("it-IT")}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold">Regali Riscattati da te</h2>
          </div>
          {redeemed.length === 0 ? (
            <p className="text-slate-400 text-sm">Non hai ancora riscattato codici regalo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Codice</th>
                    <th className="py-3 px-4">Entità</th>
                    <th className="py-3 px-4">Riscattato il</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {redeemed.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-300">{r.code}</td>
                      <td className="py-3 px-4">
                        {r.type === "credits" ? `${r.amount_or_tier} Crediti AI` : `Abbonamento ${r.amount_or_tier.toUpperCase()}`}
                      </td>
                      <td className="py-3 px-4">{r.redeemed_at ? new Date(r.redeemed_at).toLocaleDateString("it-IT") : "Sconosciuta"}</td>
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
