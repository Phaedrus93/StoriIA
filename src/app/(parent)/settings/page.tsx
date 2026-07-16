"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hashPinAction } from "@/app/actions/pin";
import {
  UserCog,
  ShieldCheck,
  CreditCard,
  Bell,
  Eye,
  Lock,
  Mail,
  Sparkles,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Sun,
  Moon,
  Sliders,
  Type,
} from "lucide-react";
import ConfirmationModal from "@/components/ConfirmationModal";

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTabParam = searchParams.get("tab") || "account";
  const [activeTab, setActiveTab] = useState<string>(activeTabParam);

  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");

  // Tab 1: Account (Password & Billing Profile)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("IT");
  const [billingProfileStatus, setBillingProfileStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [updatingBillingProfile, setUpdatingBillingProfile] = useState(false);

  // Tab 2: Sicurezza & PIN
  const [hasPinConfigured, setHasPinConfigured] = useState<boolean | null>(null);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinStatus, setPinStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [updatingPin, setUpdatingPin] = useState(false);

  // Tab 3: Fatturazione e Abbonamento (Summary)
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [creditsBalance, setCreditsBalance] = useState<number>(0);

  // Tab 4: Notifiche
  const [emailBillingAlerts, setEmailBillingAlerts] = useState(true);
  const [emailActivitySummary, setEmailActivitySummary] = useState(true);
  const [emailLowCredits, setEmailLowCredits] = useState(true);
  const [updatingNotifPrefs, setUpdatingNotifPrefs] = useState(false);
  const [notifPrefStatus, setNotifPrefStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Tab 5: Accessibilità e Lettura
  const [childrenList, setChildrenList] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [nightMode, setNightMode] = useState<boolean>(false);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [fontSize, setFontSize] = useState<string>("medium");
  const [accessibilityStatus, setAccessibilityStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [updatingAccessibility, setUpdatingAccessibility] = useState(false);

  // Tab 6: Privacy & Delete
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<{ type: "error"; msg: string } | null>(null);

  useEffect(() => {
    setActiveTab(searchParams.get("tab") || "account");
  }, [searchParams]);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    const { data } = await supabase.auth.getUser();
    if (data.user?.email) {
      setUserEmail(data.user.email);
    }

    try {
      // Caricamento profilo fatturazione
      const bpRes = await fetch("/api/family/billing-profile");
      if (bpRes.ok) {
        const bpJson = await bpRes.json();
        if (bpJson.billingProfile) {
          setFirstName(bpJson.billingProfile.first_name || "");
          setLastName(bpJson.billingProfile.last_name || "");
          setTaxId(bpJson.billingProfile.tax_id || "");
          setBillingAddress(bpJson.billingProfile.billing_address || "");
          setCity(bpJson.billingProfile.city || "");
          setPostalCode(bpJson.billingProfile.postal_code || "");
          setCountry(bpJson.billingProfile.country || "IT");
        }
      }

      // Caricamento status fatturazione
      const bsRes = await fetch("/api/family/billing-status");
      if (bsRes.ok) {
        const bsJson = await bsRes.json();
        if (bsJson.family) {
          setSubscriptionTier(bsJson.family.subscription_tier || "free");
          setCreditsBalance(bsJson.family.credits_balance || 0);
        }
      }

      // Caricamento preferenze notifiche
      const notifRes = await fetch("/api/notifications/preferences");
      if (notifRes.ok) {
        const notifJson = await notifRes.json();
        if (notifJson.preferences) {
          setEmailBillingAlerts(notifJson.preferences.email_billing_alerts ?? true);
          setEmailActivitySummary(notifJson.preferences.email_activity_summary ?? true);
          setEmailLowCredits(notifJson.preferences.email_low_credits ?? true);
        }
      }

      // Caricamento status PIN configurato
      if (data.user) {
        const { data: famData } = await supabase
          .from("families")
          .select("id")
          .eq("parent_user_id", data.user.id)
          .single();
        if (famData) {
          const { data: statusRows } = await supabase.rpc("get_lockout_status", {
            p_family_id: famData.id,
          });
          const row = statusRows && statusRows.length > 0 ? statusRows[0] : null;
          setHasPinConfigured(!!(row && row.pin_hash));
        } else {
          setHasPinConfigured(false);
        }
      }

      // Caricamento profili figli per accessibilità
      const { data: childProfiles } = await supabase
        .from("child_profiles")
        .select("*")
        .order("created_at", { ascending: true });

      if (childProfiles && childProfiles.length > 0) {
        setChildrenList(childProfiles);
        const first = childProfiles[0];
        setSelectedChildId(first.id);
        setNightMode(first.night_mode || false);
        setBrightness(first.brightness || 100);
        setContrast(first.contrast || 100);
        setFontSize(first.font_size || "medium");
      }
    } catch {
      // Ignore initial fetch errors
    }
    setLoading(false);
  }

  const handleSelectChildAccessibility = (id: string) => {
    setSelectedChildId(id);
    const found = childrenList.find((c) => c.id === id);
    if (found) {
      setNightMode(found.night_mode || false);
      setBrightness(found.brightness || 100);
      setContrast(found.contrast || 100);
      setFontSize(found.font_size || "medium");
    }
  };

  // Handlers per il salvataggio
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);
    if (!currentPassword) {
      setPasswordStatus({ type: "error", msg: "Inserisci la password attuale per confermare." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: "error", msg: "Le nuove password non coincidono." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus({ type: "error", msg: "La password deve contenere almeno 6 caratteri." });
      return;
    }
    setUpdatingPassword(true);
    if (userEmail && currentPassword) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });
      if (signInErr) {
        setPasswordStatus({ type: "error", msg: "La password attuale inserita non è corretta." });
        setUpdatingPassword(false);
        return;
      }
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);
    if (error) {
      setPasswordStatus({ type: "error", msg: error.message });
    } else {
      setPasswordStatus({ type: "success", msg: "Password aggiornata con successo!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleUpdateBillingProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillingProfileStatus(null);
    setUpdatingBillingProfile(true);
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
        throw new Error(data.error || "Errore aggiornamento dati fiscali");
      }
      setBillingProfileStatus({ type: "success", msg: "Dati di fatturazione salvati con successo." });
    } catch (err: any) {
      setBillingProfileStatus({ type: "error", msg: err.message });
    } finally {
      setUpdatingBillingProfile(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinStatus(null);
    if (hasPinConfigured && !currentPin) {
      setPinStatus({ type: "error", msg: "Inserisci il PIN attuale per confermare la modifica." });
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setPinStatus({ type: "error", msg: "Il nuovo PIN deve essere composto esattamente da 4 cifre numeriche." });
      return;
    }
    if (newPin !== confirmNewPin) {
      setPinStatus({ type: "error", msg: "I due PIN inseriti non coincidono." });
      return;
    }
    setUpdatingPin(true);
    try {
      if (hasPinConfigured && currentPin) {
        const resVerify = await fetch("/api/child-mode/verify-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: currentPin }),
        });
        if (!resVerify.ok) {
          setPinStatus({ type: "error", msg: "Il PIN attuale inserito non è corretto." });
          setUpdatingPin(false);
          return;
        }
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error("Utente non autenticato.");
      }
      const { data: familyData } = await supabase
        .from("families")
        .select("id")
        .eq("parent_user_id", userData.user.id)
        .single();
      if (!familyData) {
        throw new Error("Famiglia non trovata per questo genitore.");
      }
      const hashedPin = await hashPinAction(newPin, familyData.id);
      const { error: rpcError } = await supabase.rpc("set_parent_pin_hash", {
        p_family_id: familyData.id,
        p_pin_hash: hashedPin,
      });
      if (rpcError) {
        throw new Error(rpcError.message);
      }
      setHasPinConfigured(true);
      setPinStatus({ type: "success", msg: "PIN di sicurezza impostato ed aggiornato con successo!" });
      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
    } catch (err: any) {
      setPinStatus({ type: "error", msg: err.message || "Errore durante l'aggiornamento del PIN." });
    } finally {
      setUpdatingPin(false);
    }
  };

  const handleUpdateNotifications = async (e: React.FormEvent) => {
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
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore durante il salvataggio");
      }
      setNotifPrefStatus({ type: "success", msg: "Preferenze di notifica salvate con successo." });
    } catch (err: any) {
      setNotifPrefStatus({ type: "error", msg: err.message });
    } finally {
      setUpdatingNotifPrefs(false);
    }
  };

  const handleSaveAccessibility = async (applyToAll: boolean) => {
    setAccessibilityStatus(null);
    setUpdatingAccessibility(true);
    try {
      const body: any = {
        night_mode: nightMode,
        brightness,
        contrast,
        font_size: fontSize,
      };
      if (applyToAll) {
        body.applyToAll = true;
      } else {
        body.childId = selectedChildId;
      }

      const res = await fetch("/api/child/accessibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore salvataggio accessibilità");
      }
      setAccessibilityStatus({
        type: "success",
        msg: applyToAll
          ? "Preferenze di accessibilità applicate a tutti i figli!"
          : "Preferenze di accessibilità salvate per questo bambino!",
      });

      // Aggiorna lo state locale per rispecchiare i dati salvati
      if (applyToAll) {
        setChildrenList((prev) =>
          prev.map((c) => ({
            ...c,
            night_mode: nightMode,
            brightness,
            contrast,
            font_size: fontSize,
          }))
        );
      } else {
        setChildrenList((prev) =>
          prev.map((c) =>
            c.id === selectedChildId
              ? { ...c, night_mode: nightMode, brightness, contrast, font_size: fontSize }
              : c
          )
        );
      }
    } catch (err: any) {
      setAccessibilityStatus({ type: "error", msg: err.message });
    } finally {
      setUpdatingAccessibility(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteStatus(null);
    try {
      const res = await fetch("/api/family/delete-account", {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore durante la cancellazione account.");
      }
      window.location.href = "/";
    } catch (err: any) {
      setDeleteStatus({ type: "error", msg: err.message });
      setDeletingAccount(false);
      setDeleteModalOpen(false);
    }
  };

  const tabs = [
    { id: "account", label: "Account", icon: UserCog },
    { id: "security", label: "Sicurezza Modalità Bambino", icon: ShieldCheck },
    { id: "billing", label: "Fatturazione e Abbonamento", icon: CreditCard },
    { id: "notifications", label: "Notifiche", icon: Bell },
    { id: "accessibility", label: "Accessibilità e Lettura", icon: Eye },
    { id: "privacy", label: "Dati e Privacy", icon: Lock },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400">
        <Sparkles className="w-8 h-8 animate-spin text-indigo-500 mr-2" />
        Caricamento impostazioni...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
          <UserCog className="w-8 h-8 text-indigo-400" />
          Impostazioni Unificate
        </h1>
        <p className="text-slate-400 mt-1">
          Gestisci da un unico hub il tuo account, la sicurezza dei bambini, l&apos;abbonamento e le preferenze.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Tabs (Desktop) / Select (Mobile) */}
        <aside className="w-full md:w-64 shrink-0 space-y-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTab(t.id);
                  router.replace(`/settings?tab=${t.id}`);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                    : "bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800/80"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-indigo-400"}`} />
                {t.label}
              </button>
            );
          })}
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-8 shadow-xl">
          {/* 1. TAB ACCOUNT */}
          {activeTab === "account" && (
            <div className="space-y-8 animate-fadeIn">
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-400" />
                  Email Account
                </h2>
                <p className="text-slate-400 text-sm mt-1">L&apos;indirizzo associato al tuo profilo genitore.</p>
                <div className="mt-4 px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 font-medium">
                  {userEmail || "Email non disponibile"}
                </div>
              </div>

              {/* Cambio Password */}
              <form onSubmit={handleUpdatePassword} className="space-y-4 border-b border-slate-800 pb-8">
                <h3 className="text-lg font-bold text-white">Cambio Password</h3>
                {passwordStatus && (
                  <div
                    className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                      passwordStatus.type === "success"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {passwordStatus.msg}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password Attuale</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="La tua password corrente"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nuova Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Almeno 6 caratteri"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Conferma Nuova Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ripeti la nuova password"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={updatingPassword || !newPassword}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all disabled:opacity-50"
                >
                  {updatingPassword ? "Aggiornamento in corso..." : "Aggiorna Password"}
                </button>
              </form>

              {/* Profilo Fatturazione & Anagrafica */}
              <form onSubmit={handleUpdateBillingProfile} className="space-y-4">
                <h3 className="text-lg font-bold text-white">Profilo Fatturazione e Anagrafica</h3>
                <p className="text-slate-400 text-sm">Questi dati verranno utilizzati per le ricevute fiscali di Stripe.</p>
                {billingProfileStatus && (
                  <div
                    className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                      billingProfileStatus.type === "success"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {billingProfileStatus.msg}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cognome</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Codice Fiscale / P.IVA</label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Indirizzo di Fatturazione</label>
                  <input
                    type="text"
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Città</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">CAP</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Paese</label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={updatingBillingProfile}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all disabled:opacity-50"
                >
                  {updatingBillingProfile ? "Salvataggio..." : "Salva Anagrafica Fiscale"}
                </button>
              </form>
            </div>
          )}

          {/* 2. TAB SICUREZZA & PIN */}
          {activeTab === "security" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  PIN di Sicurezza Genitori
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Imposta o modifica il PIN numerico a 4 cifre richiesto per uscire dalla Modalità Bambino.
                </p>
              </div>

              {pinStatus && (
                <div
                  className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                    pinStatus.type === "success"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {pinStatus.msg}
                </div>
              )}

              <form onSubmit={handleUpdatePin} className="space-y-4 max-w-md">
                {hasPinConfigured && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">PIN Attuale</label>
                    <input
                      type="password"
                      maxLength={6}
                      required
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Il tuo PIN attuale"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-center font-mono text-lg tracking-widest focus:border-indigo-500 outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nuovo PIN (4 cifre)</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Es. 1234"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-center font-mono text-lg tracking-widest focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Conferma Nuovo PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ripeti le 4 cifre"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-center font-mono text-lg tracking-widest focus:border-indigo-500 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={updatingPin || newPin.length !== 4 || confirmNewPin.length !== 4}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all disabled:opacity-50"
                >
                  {updatingPin ? "Impostazione PIN..." : "Salva Nuovo PIN"}
                </button>
              </form>
            </div>
          )}

          {/* 3. TAB FATTURAZIONE E ABBONAMENTO (LINK DIRETTO A /billing/manage) */}
          {activeTab === "billing" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-400" />
                  Riepilogo Abbonamento e Crediti
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Consulta il tuo piano attuale e accedi al portale di gestione completo per rinnovi, add-on e pagamenti.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Piano Attivo</span>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-white capitalize">{subscriptionTier}</span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
                        subscriptionTier === "family"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : subscriptionTier === "premium"
                          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {subscriptionTier === "family" ? "Piano Famiglia" : subscriptionTier === "premium" ? "Piano Premium" : "Piano Free"}
                    </span>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Crediti AI Disponibili</span>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-6 h-6 text-amber-400" />
                      {creditsBalance}
                    </span>
                    <Link
                      href="/billing"
                      className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline"
                    >
                      Acquista Crediti
                    </Link>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap gap-4">
                <Link
                  href="/billing/manage"
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Gestisci abbonamento e storico
                </Link>
                <Link
                  href="/billing"
                  className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Confronta Piani e Add-on
                </Link>
              </div>
            </div>
          )}

          {/* 4. TAB NOTIFICHE */}
          {activeTab === "notifications" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-400" />
                  Preferenze Notifiche Email
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Scegli per quali eventi desideri ricevere comunicazioni via posta elettronica.
                </p>
              </div>

              {notifPrefStatus && (
                <div
                  className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                    notifPrefStatus.type === "success"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {notifPrefStatus.msg}
                </div>
              )}

              <form onSubmit={handleUpdateNotifications} className="space-y-4 max-w-xl">
                <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white text-sm block">Avvisi di Fatturazione e Rinnovo</span>
                    <span className="text-xs text-slate-400 block">Ricevi ricevute, conferme e avvisi sui pagamenti Stripe.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailBillingAlerts}
                    onChange={(e) => setEmailBillingAlerts(e.target.checked)}
                    className="w-5 h-5 rounded accent-indigo-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white text-sm block">Riepilogo Attività dei Bambini</span>
                    <span className="text-xs text-slate-400 block">Report e traguardi raggiunti dai tuoi figli nella lettura.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailActivitySummary}
                    onChange={(e) => setEmailActivitySummary(e.target.checked)}
                    className="w-5 h-5 rounded accent-indigo-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white text-sm block">Avviso Crediti in Esaurimento</span>
                    <span className="text-xs text-slate-400 block">Avvisami quando i crediti per generare storie stanno per terminare.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailLowCredits}
                    onChange={(e) => setEmailLowCredits(e.target.checked)}
                    className="w-5 h-5 rounded accent-indigo-600 cursor-pointer"
                  />
                </label>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={updatingNotifPrefs}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all disabled:opacity-50"
                  >
                    {updatingNotifPrefs ? "Salvataggio..." : "Salva Preferenze Notifiche"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 5. TAB ACCESSIBILITÀ E LETTURA */}
          {activeTab === "accessibility" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-400" />
                  Accessibilità e Comfort di Lettura
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Personalizza la visualizzazione del testo, il tema e il contrasto per ogni bambino o per l&apos;intera famiglia.
                </p>
              </div>

              {/* Selettore Profilo Bambino */}
              {childrenList.length > 0 ? (
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {childrenList.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectChildAccessibility(c.id)}
                      className={`px-4 py-2 rounded-2xl font-bold text-xs md:text-sm transition-all shrink-0 ${
                        selectedChildId === c.id
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-105"
                          : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm italic">Nessun profilo bambino presente in questa famiglia.</p>
              )}

              {accessibilityStatus && (
                <div
                  className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                    accessibilityStatus.type === "success"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {accessibilityStatus.msg}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Controlli */}
                <div className="space-y-6 p-6 rounded-2xl bg-slate-950 border border-slate-800">
                  {/* Modalità Notte */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="font-bold text-white text-sm flex items-center gap-2">
                        {nightMode ? <Moon className="w-4 h-4 text-amber-300" /> : <Sun className="w-4 h-4 text-amber-400" />}
                        Modalità Notte Forzata
                      </span>
                      <span className="text-xs text-slate-400 block">Tema scuro profondo per proteggere gli occhi al buio.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNightMode(!nightMode)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        nightMode ? "bg-indigo-600" : "bg-slate-800"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                          nightMode ? "translate-x-6" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Dimensione Testo */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
                      <Type className="w-4 h-4 text-indigo-400" />
                      Dimensione Testo in Lettura
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: "small", label: "Piccolo" },
                        { id: "medium", label: "Medio" },
                        { id: "large", label: "Grande" },
                        { id: "xlarge", label: "Gigante" },
                      ].map((fs) => (
                        <button
                          key={fs.id}
                          type="button"
                          onClick={() => setFontSize(fs.id)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                            fontSize === fs.id
                              ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                          }`}
                        >
                          {fs.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Luminosità */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400 uppercase">Luminosità</span>
                      <span className="text-indigo-400">{brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      step="5"
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  {/* Contrasto */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400 uppercase">Contrasto</span>
                      <span className="text-indigo-400">{contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="70"
                      max="150"
                      step="5"
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Box Anteprima Live */}
                <div className="flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase block">Anteprima Testo in Tempo Reale</span>
                    <div
                      className={`p-6 rounded-2xl border transition-all min-h-[220px] flex flex-col justify-center ${
                        nightMode
                          ? "bg-black text-amber-100 border-amber-500/30 shadow-inner"
                          : "bg-slate-900 text-slate-100 border-slate-800"
                      } ${
                        fontSize === "small"
                          ? "text-sm md:text-base leading-normal"
                          : fontSize === "large"
                          ? "text-xl md:text-2xl leading-relaxed"
                          : fontSize === "xlarge"
                          ? "text-2xl md:text-3xl font-bold leading-loose tracking-wide"
                          : "text-base md:text-lg leading-relaxed"
                      }`}
                      style={{
                        filter: `brightness(${brightness / 100}) contrast(${contrast / 100})`,
                      }}
                    >
                      <h4 className="font-extrabold mb-2 opacity-90">Il Volpino e la Stella Smeraldo</h4>
                      <p>
                        C&apos;era una volta, nel cuore incantato di Gattomarino, un piccolo esploratore curioso con gli occhi che brillavano nella notte...
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      disabled={updatingAccessibility || !selectedChildId}
                      onClick={() => handleSaveAccessibility(false)}
                      className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs md:text-sm shadow-md transition-all disabled:opacity-50"
                    >
                      {updatingAccessibility ? "Salvataggio..." : "Salva per Questo Bambino"}
                    </button>
                    <button
                      type="button"
                      disabled={updatingAccessibility || childrenList.length === 0}
                      onClick={() => handleSaveAccessibility(true)}
                      className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs md:text-sm border border-slate-700 transition-all disabled:opacity-50"
                    >
                      Applica a Tutti i Figli
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. TAB DATI & PRIVACY */}
          {activeTab === "privacy" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-400" />
                  Dati e Privacy GDPR
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Esporta l&apos;intero archivio delle tue storie e dei profili familiari o procedi con la cancellazione definitiva.
                </p>
              </div>

              {deleteStatus && (
                <div className="p-4 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-sm font-semibold">
                  {deleteStatus.msg}
                </div>
              )}

              <div className="space-y-4">
                {/* Export Dati */}
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Download className="w-5 h-5 text-emerald-400" />
                      Esporta Dati Famiglia (JSON)
                    </h3>
                    <p className="text-slate-400 text-xs md:text-sm">
                      Scarica un file strutturato contenente tutte le storie generate, i personaggi, le ambientazioni e l&apos;audit log.
                    </p>
                  </div>
                  <a
                    href="/api/family/export"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    Scarica Archivio Dati
                  </a>
                </div>

                {/* Eliminazione Account */}
                <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-rose-400" />
                      Elimina Definitivamente Account
                    </h3>
                    <p className="text-slate-400 text-xs md:text-sm">
                      L&apos;eliminazione cancellerà subito l&apos;abbonamento Stripe, i profili bambino e l&apos;intero catalogo di storie in modo irreversibile.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    Elimina Account Famiglia
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        title="Conferma Eliminazione Account"
        message="Questa azione è irreversibile. Tutte le storie, i profili bambino, i badge sbloccati e l'abbonamento verranno cancellati per sempre dal database a norma GDPR. Vuoi procedere?"
        confirmLabel="Sì, elimina tutto definitivamente"
        cancelLabel="Annulla"
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteModalOpen(false)}
        variant="danger"
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-slate-400 font-bold">Caricamento hub impostazioni...</div>}>
      <SettingsPageContent />
    </Suspense>
  );
}
