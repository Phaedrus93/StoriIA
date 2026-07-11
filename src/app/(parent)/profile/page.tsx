"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hashPinAction } from "@/app/actions/pin";
import { UserCog, KeyRound, Lock, ShieldCheck, Mail, Sparkles } from "lucide-react";

export default function ProfilePage() {
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Cambio Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Cambio PIN
  const [newPin, setNewPin] = useState("");
  const [pinStatus, setPinStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [updatingPin, setUpdatingPin] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    const { data } = await supabase.auth.getUser();
    if (data.user?.email) {
      setUserEmail(data.user.email);
    }
    setLoading(false);
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword.length < 6) {
      setPasswordStatus({
        type: "error",
        msg: "La password deve avere almeno 6 caratteri.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({
        type: "error",
        msg: "Le password inserite non coincidono.",
      });
      return;
    }

    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPasswordStatus({
        type: "error",
        msg: error.message || "Errore durante l'aggiornamento della password.",
      });
    } else {
      setPasswordStatus({
        type: "success",
        msg: "Password aggiornata con successo!",
      });
      setNewPassword("");
      setConfirmPassword("");
    }
    setUpdatingPassword(false);
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinStatus(null);

    if (!/^\d{4,6}$/.test(newPin)) {
      setPinStatus({
        type: "error",
        msg: "Il PIN deve essere composto da 4 a 6 cifre numeriche.",
      });
      return;
    }

    setUpdatingPin(true);
    try {
      const hashedPin = await hashPinAction(newPin);
      const { data: family } = await supabase.from("families").select("id").single();
      if (!family) {
        setPinStatus({
          type: "error",
          msg: "Famiglia non trovata nel database.",
        });
        setUpdatingPin(false);
        return;
      }

      const { error } = await supabase.rpc("set_parent_pin_hash", {
        p_family_id: family.id,
        p_pin_hash: hashedPin,
      });

      if (error) {
        setPinStatus({
          type: "error",
          msg: error.message || "Errore durante il salvataggio del PIN.",
        });
      } else {
        setPinStatus({
          type: "success",
          msg: "PIN genitore aggiornato con successo!",
        });
        setNewPin("");
      }
    } catch {
      setPinStatus({
        type: "error",
        msg: "Errore imprevisto durante l'aggiornamento del PIN.",
      });
    }
    setUpdatingPin(false);
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCog className="w-6 h-6 text-indigo-400" />
          <span>Profilo e Sicurezza Genitore</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Gestisci le credenziali del tuo account genitore e il PIN di protezione per la Modalità Bambino.
        </p>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-slate-400 animate-pulse">
          Caricamento profilo in corso...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Informazioni Account & Cambio Password */}
          <div className="glass-card p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
              <Mail className="w-5 h-5 text-indigo-400" />
              <div>
                <h2 className="text-lg font-bold">Account Genitore</h2>
                <p className="text-xs text-slate-400">{userEmail || "Utente autenticato"}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-indigo-400" />
                <span>Aggiorna Password</span>
              </h3>

              {passwordStatus && (
                <div
                  className={`p-3 rounded-xl text-xs mb-4 border ${
                    passwordStatus.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  {passwordStatus.msg}
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Nuova Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Almeno 6 caratteri"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Conferma Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ripeti la nuova password"
                    className="input-field"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="btn-primary w-full mt-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{updatingPassword ? "Aggiornamento..." : "Aggiorna Password"}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Gestione PIN Genitore */}
          <div className="glass-card p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
              <KeyRound className="w-5 h-5 text-pink-400" />
              <div>
                <h2 className="text-lg font-bold">Protezione Modalità Bambino</h2>
                <p className="text-xs text-slate-400">PIN richiesto per tornare all&apos;Area Genitore</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Il PIN impedisce ai bambini di uscire dall&apos;area a loro dedicata e accedere alla libreria completa o alle impostazioni della famiglia.
              </p>

              {pinStatus && (
                <div
                  className={`p-3 rounded-xl text-xs mb-4 border ${
                    pinStatus.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  {pinStatus.msg}
                </div>
              )}

              <form onSubmit={handleUpdatePin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Nuovo PIN Genitore (4-6 cifre)
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="es. 1234 o 123456"
                    className="input-field tracking-widest text-center font-mono text-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updatingPin}
                  className="btn-primary w-full mt-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{updatingPin ? "Salvataggio..." : "Salva Nuovo PIN"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
