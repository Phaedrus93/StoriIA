import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock, HelpCircle, ArrowRight } from "lucide-react";

export default function HomeFaqSection() {
  const faqs = [
    {
      question: "I dati dei miei figli vengono utilizzati per pubblicità o profilazione?",
      answer:
        "Assolutamente no. StoriIA applica una politica di 'Zero Ads e Zero Profilazione'. Nel pieno rispetto dell'Art. 8 del GDPR e della nostra etica di Privacy by Design, i dati associati ai profili bambino non vengono mai ceduti, tracciati per scopi pubblicitari né analizzati per marketing comportamentale.",
    },
    {
      question: "Che tipo di foto o informazioni personali sono necessarie per i bambini?",
      answer:
        "Nessuna fotografia reale. Per scelta di sicurezza, l'applicazione non richiede né consente il caricamento di foto reali dei minori. Ogni bambino è identificato solo da un nome di fantasia (o pseudonimo), dalla fascia d'età per calibrare il linguaggio e da un avatar vettoriale educativo illustrato scelto dal genitore.",
    },
    {
      question: "Come viene protetto l'accesso all'Area Genitori e ai pagamenti?",
      answer:
        "L'Area Genitori e le impostazioni di fatturazione sono protette da un PIN numerico obbligatorio salvato sul database PostgreSQL con hashing crittografico sicuro (OWASP). Inoltre, la Row Level Security (RLS) impedisce fisicamente a chiunque di consultare o modificare le storie e i profili di una famiglia diversa dalla propria.",
    },
    {
      question: "Posso cancellare in qualsiasi momento i dati e le storie generate?",
      answer:
        "Sì, con un singolo click. Dalla pagina Impostazioni dell'Area Genitori puoi esercitare in totale autonomia il Diritto alla Cancellazione (Oblio - Art. 17 GDPR) e il Diritto alla Portabilità (scaricando l'archivio JSON completo). L'eliminazione cancella fisicamente e in modo irreversibile ogni dato personale dal nostro database.",
    },
  ];

  return (
    <section id="faq" className="space-y-12 py-6">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sicurezza & Tutela Minori Ex Art. 8 GDPR</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          Domande Frequenti sulla <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Sicurezza</span>
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          La trasparenza è il primo principio di StoriIA. Scopri come proteggiamo ogni giorno l&apos;immaginazione e la riservatezza dei tuoi bambini.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {faqs.map((faq, idx) => (
          <div
            key={idx}
            className="glass-card p-7 border-slate-800/80 hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-4 group"
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-white group-hover:text-emerald-300 transition-colors">
                  {faq.question}
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pl-11">
                {faq.answer}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card max-w-4xl mx-auto p-6 md:p-8 border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-slate-950/80 to-slate-950 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white">
              Vuoi approfondire tutti i dettagli normativi sul trattamento dati?
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Consulta il documento ufficiale conforme al Regolamento UE 2016/679 (GDPR).
            </p>
          </div>
        </div>

        <Link
          id="faq-privacy-link"
          href="/privacy"
          className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shrink-0 shadow-lg shadow-emerald-600/20 transition-all"
        >
          <span>Leggi Informativa Privacy</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
