import React from "react";
import Link from "next/link";
import { ArrowLeft, Cookie } from "lucide-react";

export const metadata = {
  title: "Informativa sui Cookie | StoriIA",
  description: "Informativa sull'utilizzo dei cookie tecnici in StoriIA.",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white py-12 px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-slate-900 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Torna alla Home</span>
          </Link>
          <div className="flex items-center gap-2 text-amber-400">
            <Cookie className="w-5 h-5" />
            <span className="text-sm font-bold">Cookie Policy</span>
          </div>
        </div>

        <div className="glass-card p-8 md:p-12 space-y-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Informativa sui Cookie
            </h1>
            <p className="text-xs text-slate-400 mt-2">
              Ultimo aggiornamento: Luglio 2026
            </p>
          </div>

          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                1. Solo Cookie Tecnici e di Sicurezza
              </h2>
              <p>
                StoriIA utilizza <strong>esclusivamente cookie tecnici strettamente
                necessari</strong> al corretto funzionamento della piattaforma,
                alla gestione dell&apos;autenticazione sicura (Supabase Auth) e
                al mantenimento della sessione in Modalità Bambino (cookie{" "}
                <code>storiia_child_mode</code> httpOnly).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                2. Assenza di Cookie Pubblicitari o di Terze Parti
              </h2>
              <p>
                Non viene installato alcun cookie di profilazione commerciale,
                pubblicitaria o di tracciamento invasivo di terze parti. Non è
                pertanto richiesto un banner di consenso preventivo ai cookie di
                profilazione ai sensi del GDPR.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
