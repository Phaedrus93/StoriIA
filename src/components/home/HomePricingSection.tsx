import React from "react";
import Link from "next/link";
import { Check, Sparkles, Wand2, Users, Shield, Award } from "lucide-react";
import { type SubscriptionPlanData } from "@/lib/plans";

interface HomePricingSectionProps {
  plans: SubscriptionPlanData[];
  isAuthenticated: boolean;
}

export default function HomePricingSection({
  plans,
  isAuthenticated,
}: HomePricingSectionProps) {
  return (
    <section id="pricing" className="space-y-12 py-6">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
          <Award className="w-3.5 h-3.5 text-amber-400" />
          <span>Fonte di Verità Unica Sincronizzata</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          Piani Trasparenti per Ogni <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Famiglia</span>
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Nessun costo nascosto o sorpresa in fattura. I prezzi visualizzati sono caricati in tempo reale dal nostro database centralizzato e coincidono esattamente con le tariffe Stripe.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
        {plans.map((plan) => {
          const isPremium = plan.tier === "premium";
          const isFree = plan.tier === "free";
          const formattedPrice = isFree || plan.priceMonthlyCents === 0
            ? "0,00 €"
            : `${(plan.priceMonthlyCents / 100).toLocaleString("it-IT", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} €`;

          let ctaHref = "/register";
          let ctaLabel = "Inizia Gratis Subito";

          if (isAuthenticated) {
            if (isFree) {
              ctaHref = "/dashboard";
              ctaLabel = "Entra in Dashboard";
            } else {
              ctaHref = "/settings"; // O /billing/manage raggiungibile da /settings
              ctaLabel = "Gestisci Abbonamento";
            }
          } else if (!isFree) {
            ctaHref = `/register?plan=${plan.tier}`;
            ctaLabel = "Crea Account e Abbonati";
          }

          return (
            <div
              key={plan.tier}
              className={`glass-card p-8 flex flex-col justify-between relative transition-all duration-300 transform hover:-translate-y-1 ${
                isPremium
                  ? "border-indigo-500/60 shadow-2xl shadow-indigo-500/20 bg-gradient-to-b from-indigo-950/40 via-slate-950/80 to-slate-950/90"
                  : "border-slate-800/80 hover:border-slate-700"
              }`}
            >
              {isPremium && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[11px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Più Scelto</span>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-400 min-h-[32px] leading-relaxed">
                    {plan.description ||
                      (isFree
                        ? "Perfetto per provare l'avventura incantata di StoriIA."
                        : plan.tier === "family"
                        ? "La soluzione completa per famiglie numerose con storie illimitate."
                        : "L'esperienza AI completa con morali e storie ad alta magia.")}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white tracking-tight">
                    {formattedPrice}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {isFree ? "/ per sempre" : "/ mese"}
                  </span>
                </div>

                <ul className="space-y-3.5 pt-2 text-xs text-slate-300">
                  <li className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>
                      Fino a <strong className="text-white">{plan.maxChildren}</strong> profili bambino personalizzati
                    </span>
                  </li>

                  <li className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>
                      {isFree ? (
                        <>
                          <strong className="text-white">{plan.welcomeCredits}</strong> crediti di benvenuto iniziali
                        </>
                      ) : (
                        <>
                          <strong className="text-white">{plan.monthlyCredits}</strong> crediti AI rigenerati ogni mese
                        </>
                      )}
                    </span>
                  </li>

                  <li className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>
                      {plan.allMorals ? (
                        <strong className="text-indigo-300">Tutte le morali e avventure sbloccate</strong>
                      ) : (
                        <span>Accesso alle morali base educative</span>
                      )}
                    </span>
                  </li>

                  <li className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>Modalità Bambino protetta da PIN</span>
                  </li>

                  <li className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>Zero pubblicità e tutela GDPR ex art. 8</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8 mt-6 border-t border-slate-800/80">
                <Link
                  id={`cta-plan-${plan.tier}`}
                  href={ctaHref}
                  className={`w-full py-3.5 px-6 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                    isPremium
                      ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-indigo-500/30"
                      : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/80"
                  }`}
                >
                  <Wand2 className="w-4 h-4" />
                  <span>{ctaLabel}</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
