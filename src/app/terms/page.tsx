import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Termini di Servizio | StoriIA",
  description: "Termini di Servizio ufficiali della piattaforma StoriIA.",
};

export default function TermsPage() {
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
          <div className="flex items-center gap-2 text-indigo-400">
            <FileText className="w-5 h-5" />
            <span className="text-sm font-bold">Documentazione Legale</span>
          </div>
        </div>

        <div className="glass-card p-8 md:p-12 space-y-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Termini di Servizio
            </h1>
            <p className="text-xs text-slate-400 mt-2">
              Ultimo aggiornamento: Luglio 2026 • Versione 1.1
            </p>
          </div>

          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                1. Accettazione dei Termini
              </h2>
              <p>
                Utilizzando la piattaforma <strong>StoriIA</strong>, l&apos;utente
                dichiara di aver letto, compreso e accettato integralmente i
                presenti Termini di Servizio. L&apos;iscrizione alla piattaforma è
                riservata a genitori o tutori legali maggiorenni.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                2. Oggetto del Servizio
              </h2>
              <p>
                StoriIA offre uno strumento assistito da Intelligenza
                Artificiale (Google Gemini) finalizzato alla creazione e
                gestione di storie educative personalizzate in formato
                esclusivamente testuale per bambini e famiglie.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                3. Responsabilità Genitoriale e Controllo dei Contenuti
              </h2>
              <p>
                Il genitore titolare dell&apos;account è l&apos;unico responsabile della
                selezione dei parametri di generazione (Personaggi, Ambientazioni,
                Morali ed Età Target) e si impegna a visionare le storie generate
                prima di renderle disponibili al bambino in Modalità Bambino.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                4. Proprietà dei Contenuti Generate
              </h2>
              <p>
                I testi generati restano di proprietà della famiglia utente per
                uso domestico e personale. È vietato l&apos;utilizzo commerciale o
                la rivendita dei testi prodotti senza esplicita autorizzazione.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                5. Sospensione e Cancellazione
              </h2>
              <p>
                L&apos;utente può in qualsiasi momento eliminare definitivamente il
                proprio account e tutti i dati familiari dalle impostazioni
                dell&apos;Area Genitori.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
