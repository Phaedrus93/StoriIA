"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { hashPinAction } from "@/app/actions/pin";
import { UserCog, KeyRound, Lock, ShieldCheck, Mail, Sparkles, Bell } from "lucide-react";

export default function ProfilePage() {
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Cambio Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Cambio PIN
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinStatus, setPinStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [updatingPin, setUpdatingPin] = useState(false);

  // Preferenze Notifiche
  const [emailBillingAlerts, setEmailBillingAlerts] = useState(true);
  const [emailActivitySummary, setEmailActivitySummary] = useState(true);
  const [emailLowCredits, setEmailLowCredits] = useState(true);
  const [updatingNotifPrefs, setUpdatingNotifPrefs] = useState(false);
  const [notifPrefStatus, setNotifPrefStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Profilo Fatturazione & Anagrafica Fiscale
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("IT");
  const [billingStatus, setBillingStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [updatingBilling, setUpdatingBilling] = useState(false);

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
    try {
      const res = await fetch("/api/family/billing-profile");
      if (res.ok) {
        const json = await res.json();
        if (json.billingProfile) {
          setFirstName(json.billingProfile.first_name || "");
          setLastName(json.billingProfile.last_name || "");
          setTaxId(json.billingProfile.tax_id || "");
          setBillingAddress(json.billingProfile.billing_address || "");
          setCity(json.billingProfile.city || "");
          setPostalCode(json.billingProfile.postal_code || "");
          setCountry(json.billingProfile.country || "IT");
        }
      }
      const notifRes = await fetch("/api/notifications/preferences");
      if (notifRes.ok) {
        const notifJson = await notifRes.json();
        if (notifJson.preferences) {
          setEmailBillingAlerts(notifJson.preferences.email_billing_alerts ?? true);
          setEmailActivitySummary(notifJson.preferences.email_activity_summary ?? true);
          setEmailLowCredits(notifJson.preferences.email_low_credits ?? true);
        }
      }
    } catch {
      // Ignore initial fetch error
    }
    setLoading(false);
  }

  const handleUpdateBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillingStatus(null);
    setUpdatingBilling(true);
    try {
      const res = await fetch("/api/family/billing-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          tax_id: taxId,
          billing_address: billingAddress,
          city,
          postal_code: postalCode,
          country,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore durante il salvataggio");
      }
      setBillingStatus({
        type: "success",
        msg: "Dati di fatturazione e anagrafica aggiornati con successo.",
      });
    } catch (err: unknown) {
      setBillingStatus({
        type: "error",
        msg:
          err instanceof Error
            ? err.message
            : "Impossibile salvare i dati di fatturazione",
      });
    } finally {
      setUpdatingBilling(false);
    }
  };

  const handleUpdateNotificationPreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifPrefStatus(null);
    setUpdatingNotifPrefs(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_billing_alerts: emailBillingAlerts,
          email_activity_summary: emailActivitySummary,
          email_low_credits: emailLowCredits,
        }),
      });
      if (!res.ok) throw new Error("Errore durante il salvataggio");
      setNotifPrefStatus({
        type: "success",
        msg: "Preferenze di notifica salvate con successo!",
      });
    } catch {
      setNotifPrefStatus({
        type: "error",
        msg: "Impossibile salvare le preferenze di notifica.",
      });
    } finally {
      setUpdatingNotifPrefs(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword.length < 6) {
      setPasswordStatus({
        type: "error",
        msg: "La nuova password deve avere almeno 6 caratteri.",
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

    if (userEmail && currentPassword) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });
      if (signInErr) {
        setPasswordStatus({
          type: "error",
          msg: "La password attuale inserita non è corretta.",
        });
        setUpdatingPassword(false);
        return;
      }
    }

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
      setCurrentPassword("");
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
        msg: "Il nuovo PIN deve essere composto da 4 a 6 cifre numeriche.",
      });
      return;
    }

    if (newPin !== confirmNewPin) {
      setPinStatus({
        type: "error",
        msg: "I due nuovi PIN inseriti non coincidono.",
      });
      return;
    }

    setUpdatingPin(true);
    try {
      if (currentPin) {
        const resVerify = await fetch("/api/child-mode/verify-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: currentPin }),
        });
        if (!resVerify.ok) {
          setPinStatus({
            type: "error",
            msg: "Il PIN attuale inserito non è corretto.",
          });
          setUpdatingPin(false);
          return;
        }
      }

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
        setCurrentPin("");
        setNewPin("");
        setConfirmNewPin("");
      }
    } catch {
      setPinStatus({
        type: "error",
        msg: "Errore imprevisto durante l'aggiornamento del PIN.",
      });
    }
    setUpdatingPin(false);
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleExportData = () => {
    window.open("/api/family/export", "_blank");
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/family/delete-account", {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Impossibile eliminare l'account.");
      }
      window.location.href = "/login";
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : "Errore durante l'eliminazione"
      );
      setDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <Link
          href="/dashboard"
          className="inline-block text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors mb-3"
        >
          ← Torna alla Dashboard Genitore
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <UserCog className="w-6 h-6 text-indigo-400" />
          <span>Profilo e Sicurezza Genitore</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Gestisci le credenziali di accesso, il PIN di sicurezza e i dati privacy della tua famiglia
        </p>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-slate-400 text-sm">
          Caricamento dati profilo in corso...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card Cambio Password */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
                <Lock className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Cambia Password
                </h2>
              </div>

              {passwordStatus && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    passwordStatus.type === "success"
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                  }`}
                >
                  {passwordStatus.msg}
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Password Attuale
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="La tua password corrente"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Nuova Password (min. 6 caratteri)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Conferma Nuova Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ripeti nuova password"
                    className="input-field"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="btn-primary w-full mt-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {updatingPassword ? "Aggiornamento..." : "Aggiorna Password"}
                  </span>
                </button>
              </form>
            </div>

            {/* Card Cambio PIN Genitore */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
                <KeyRound className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Aggiorna PIN di Sicurezza
                </h2>
              </div>

              {pinStatus && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    pinStatus.type === "success"
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                  }`}
                >
                  {pinStatus.msg}
                </div>
              )}

              <form onSubmit={handleUpdatePin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    PIN Attuale
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    placeholder="Il tuo PIN attuale"
                    className="input-field tracking-widest text-center font-mono text-lg"
                  />
                </div>

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
                    placeholder="es. 1234"
                    className="input-field tracking-widest text-center font-mono text-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Conferma Nuovo PIN
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value)}
                    placeholder="Ripeti nuovo PIN"
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

          {/* Card Anagrafica Fiscale & Fatturazione Genitore */}
          <div className="glass-card p-6 space-y-4 border-indigo-500/20">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
              <Mail className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Anagrafica Fiscale & Fatturazione Genitore
              </h2>
            </div>

            {billingStatus && (
              <div
                className={`p-3 rounded-xl text-xs ${
                  billingStatus.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                }`}
              >
                {billingStatus.msg}
              </div>
            )}

            <form onSubmit={handleUpdateBilling} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Nome genitore"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Cognome *
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Cognome genitore"
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Codice Fiscale / P.IVA
                  </label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="es. RSSMRA80A01H501Z"
                    className="input-field uppercase font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Paese
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="IT"
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Indirizzo di Fatturazione
                  </label>
                  <input
                    type="text"
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder="Via/Piazza..."
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    CAP & Città
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="es. 00100 Roma"
                    className="input-field"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={updatingBilling}
                className="btn-primary w-full sm:w-auto text-xs py-2.5 px-6"
              >
                <span>
                  {updatingBilling
                    ? "Salvataggio..."
                    : "Salva Anagrafica Fiscale"}
                </span>
              </button>
            </form>
          </div>

          {/* Card Preferenze Notifica */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
              <Bell className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Impostazioni Notifiche Email & Avvisi
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Scegli quali aggiornamenti ricevere via email. Le notifiche in-app nel centro notifiche (🔔) resteranno sempre attive.
            </p>

            {notifPrefStatus && (
              <div
                className={`p-3 rounded-xl text-xs border ${
                  notifPrefStatus.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                {notifPrefStatus.msg}
              </div>
            )}

            <form onSubmit={handleUpdateNotificationPreferences} className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all">
                  <div>
                    <div className="text-xs font-bold text-white">Fatturazione & Scadenze Abbonamento</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Avvisi su abbonamento in scadenza, rinnovi e pagamenti
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailBillingAlerts}
                    onChange={(e) => setEmailBillingAlerts(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all">
                  <div>
                    <div className="text-xs font-bold text-white">Crediti AI in esaurimento</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Avviso automatico quando il saldo scende sotto i 5 crediti
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailLowCredits}
                    onChange={(e) => setEmailLowCredits(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all">
                  <div>
                    <div className="text-xs font-bold text-white">Attività & Traguardi Bambino</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Aggiornamenti su nuove missioni completate e contenuti sbloccati
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailActivitySummary}
                    onChange={(e) => setEmailActivitySummary(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={updatingNotifPrefs}
                className="btn-primary w-full sm:w-auto text-xs py-2.5 px-6"
              >
                <span>
                  {updatingNotifPrefs ? "Salvataggio..." : "Salva Preferenze Notifica"}
                </span>
              </button>
            </form>
          </div>

          {/* Card Privacy & Diritto all'Oblio GDPR */}
          <div className="glass-card p-6 space-y-4 border-rose-500/20">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
              <ShieldCheck className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Privacy & Diritto all&apos;Oblio (GDPR Art. 17 e 20)
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              In conformità al Regolamento Europeo sulla Protezione dei Dati
              (GDPR), puoi esportare in qualsiasi momento tutti i dati della tua
              famiglia oppure eliminare definitivamente il tuo account.
              L&apos;eliminazione rimuoverà irreversibilmente tutti i profili
              bambino, i personaggi, le ambientazioni e le storie create.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleExportData}
                className="btn-secondary text-xs w-full sm:w-auto"
              >
                Esporta Dati Famiglia (JSON)
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors w-full sm:w-auto"
              >
                Elimina Account e Dati Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale di Conferma Eliminazione Account */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-card p-6 border-rose-500/40 space-y-4">
            <h3 className="text-lg font-bold text-white">
              Conferma Eliminazione Definitiva
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sei davvero sicuro di voler eliminare il tuo account e tutti i
              dati dei tuoi figli? L&apos;operazione è irreversibile e i dati non
              potranno essere recuperati.
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary text-xs"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={handleDeleteAccount}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
              >
                {deletingAccount
                  ? "Eliminazione in corso..."
                  : "Sì, Elimina Definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
