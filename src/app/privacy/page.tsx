import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock } from "lucide-react";

export const metadata = {
  title: "Informativa sulla Privacy & Tutela Minori (GDPR) | StoriIA",
  description:
    "Informativa sulla privacy di StoriIA con sezione dedicata alla tutela dei dati dei minori ex art. 8 GDPR.",
};

export default function PrivacyPage() {
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
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-sm font-bold">Privacy & GDPR</span>
          </div>
        </div>

        <div className="glass-card p-8 md:p-12 space-y-8 border-emerald-500/20">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Informativa sulla Privacy & Tutela Minori
            </h1>
            <p className="text-xs text-slate-400 mt-2">
              Conforme al Regolamento UE 2016/679 (GDPR) • Ultimo aggiornamento:
              Luglio 2026
            </p>
          </div>

          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                1. Titolare del Trattamento
              </h2>
              <p>
                Il Titolare del Trattamento dei dati raccolti tramite
                l&apos;applicazione <strong>StoriIA</strong> opera nel rigoroso
                rispetto del Regolamento Generale sulla Protezione dei Dati (UE
                2016/679).
              </p>
            </section>

            <section className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <Lock className="w-4 h-4" />
                <span>2. Tutela Esplicita dei Dati dei Minori (Art. 8 GDPR)</span>
              </div>
              <p className="text-xs text-emerald-200/90 leading-relaxed">
                StoriIA adotta politiche di massima protezione verso i minori:
                <br />• <strong>Nessuna Profilazione Commerciale o Pubblicità</strong>: i
                dati associati ai profili bambino non vengono mai utilizzati per
                marketing, tracciamento pubblicitario o profilazione comportamentale.
                <br />• <strong>Assenza di Dati Biometrici o Foto Reali</strong>: per
                scelta di privacy by design, la piattaforma non raccoglie né
                consente il caricamento di fotografie reali di minori, utilizzando
                esclusivamente avatar vettoriali illustrati.
                <br />• <strong>Consenso Genitoriale Esclusivo</strong>: la creazione e
                gestione dei profili è operata interamente dal genitore o tutore
                legale autenticato.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                3. Finalità e Base Giuridica del Trattamento
              </h2>
              <p>
                I dati raccolti (email genitore, nomi o pseudonimi dei figli,
                storie generate) sono trattati esclusivamente per erogare le
                funzionalità dell&apos;applicazione, compresa l&apos;elaborazione
                dei testi educativi tramite Google Gemini AI nel pieno rispetto
                della riservatezza.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                4. Diritto all&apos;Oblio ed Esportazione dei Dati (GDPR Art. 17 e 20)
              </h2>
              <p>
                Il genitore può esercitare in autonomia e in qualsiasi momento il
                proprio <strong>Diritto alla Portabilità</strong> (scaricando
                l&apos;archivio JSON completo della famiglia) e il{" "}
                <strong>Diritto alla Cancellazione Definitiva (Oblio)</strong>{" "}
                dalla pagina Impostazioni dell&apos;Area Genitori. L&apos;eliminazione
                comporta la rimozione fisica immediata e irreversibile di ogni
                dato personale e di tutti i profili figlio dal database.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
