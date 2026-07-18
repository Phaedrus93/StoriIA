import React from "react";
import { ShieldCheck, Wand2, Smile, Sparkles, ArrowRight } from "lucide-react";

export default function HomeHowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Configura e Proteggi la Famiglia",
      description:
        "Crea i profili personalizzati dei tuoi bambini, assegna le fasce d'età educative e metti in sicurezza l'Area Genitori con un PIN numerico di grado bancario (hashing OWASP).",
      icon: ShieldCheck,
      color: "from-indigo-500 to-blue-600",
      badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    },
    {
      number: "02",
      title: "Inventa Avventure con Google Gemini",
      description:
        "Seleziona i tuoi eroi nel Laboratorio Personaggi, scegli lezioni morali positive (amicizia, onestà, empatia) e lascia che l'intelligenza artificiale generi favole incantate e su misura.",
      icon: Wand2,
      color: "from-purple-500 to-pink-600",
      badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    },
    {
      number: "03",
      title: "Modalità Lettura Bambino Protetta",
      description:
        "Affida il dispositivo ai piccoli in un ambiente gamificato, sicuro e privo di distrazioni o pubblicità. Ogni lettura sblocca Punti Avventura per raccogliere cornici e badge magici.",
      icon: Smile,
      color: "from-emerald-500 to-teal-600",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
  ];

  return (
    <section className="space-y-12">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Semplice, Sicuro e Educativo</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          Come Funziona <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">StoriIA</span> in 3 Step
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Dalla sicurezza dei dati alla magia della narrazione AI: ecco come trasformiamo la lettura serale in un rituale indimenticabile per tutta la famiglia.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
        {steps.map((step, idx) => {
          const IconComponent = step.icon;
          return (
            <div
              key={step.number}
              className="glass-card p-8 flex flex-col justify-between relative group hover:border-slate-700 transition-all duration-300 transform hover:-translate-y-1 shadow-lg"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${step.color} flex items-center justify-center text-white font-bold shadow-md group-hover:scale-110 transition-transform`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${step.badgeColor}`}>
                    Step {step.number}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-lg text-white group-hover:text-indigo-300 transition-colors mb-2">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-slate-900 border border-slate-800 items-center justify-center text-slate-500 shadow-md">
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
