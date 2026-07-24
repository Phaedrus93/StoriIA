"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  UserCheck,
  Trophy,
  BookOpen,
  FileText,
  MessageSquare,
  Settings,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  Check,
  Edit2,
  X,
  Sparkles,
  Gift,
  Book,
} from "lucide-react";
import ConfirmationModal from "@/components/ConfirmationModal";
import { createClient } from "@/lib/supabase/client";

const VALID_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<string>("plans");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const confirmAction = (message: string, onConfirm: () => void) => {
    setConfirmConfig({ isOpen: true, title: "Conferma Operazione", message, onConfirm });
  };

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 text-sm font-medium transition-all ${
            toast.type === "success"
              ? "bg-emerald-900/90 border-emerald-500/50 text-emerald-200"
              : "bg-rose-900/90 border-rose-500/50 text-rose-200"
          }`}
        >
          {toast.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        {[
          { id: "plans", label: "Piani & Limiti", icon: CreditCard },
          { id: "avatars", label: "Preset Avatar", icon: UserCheck },
          { id: "gamification", label: "Gamification (Badge, Cornici)", icon: Trophy },
          { id: "narrative", label: "Catalogo (Stili, Tratti, Ambienti)", icon: Book },
          { id: "morals", label: "Morali Predefinite", icon: BookOpen },
          { id: "stories", label: "Storie Preset", icon: FileText },
          { id: "texts", label: "Testi Fissi (Copy)", icon: MessageSquare },
          { id: "giftcodes", label: "Gift Codes", icon: Gift },
          { id: "config", label: "Parametri App & AI", icon: Settings },
          { id: "reports", label: "Segnalazioni", icon: AlertTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-500"
                  : "bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === "plans" && <SubscriptionPlansTab showToast={showToast} />}
      {activeTab === "avatars" && <AvatarPresetsTab showToast={showToast} confirmAction={confirmAction} />}
      {activeTab === "gamification" && <GamificationTab showToast={showToast} confirmAction={confirmAction} />}
      {activeTab === "narrative" && <NarrativeCatalogTab showToast={showToast} confirmAction={confirmAction} />}
      {activeTab === "morals" && <MoralsTab showToast={showToast} confirmAction={confirmAction} />}
      {activeTab === "stories" && <PresetStoriesTab showToast={showToast} confirmAction={confirmAction} />}
      {activeTab === "texts" && <FixedTextsTab showToast={showToast} />}
      {activeTab === "giftcodes" && <GiftCodesTab showToast={showToast} />}
      {activeTab === "config" && <AppConfigTab showToast={showToast} />}
      {activeTab === "reports" && <ContentReportsTab showToast={showToast} />}

      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={() => {
          confirmConfig.onConfirm();
          setConfirmConfig({ ...confirmConfig, isOpen: false });
        }}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        variant="danger"
        confirmLabel="Elimina"
      />
    </div>
  );
}

/* ==============================================================================
   TAB 1: SUBSCRIPTION PLANS
   ============================================================================== */
function SubscriptionPlansTab({ showToast }: { showToast: (msg: string, type?: "success" | "error") => void }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subscription-plans");
      const data = await res.json();
      if (data.plans) setPlans(data.plans);
    } catch {
      showToast("Errore durante il caricamento dei piani abbonamento", "error");
    }
    setLoading(false);
  }

  const handleFieldChange = (index: number, field: string, value: any) => {
    const updated = [...plans];
    updated[index] = { ...updated[index], [field]: value };
    setPlans(updated);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/subscription-plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Piani di abbonamento salvati e attivati nel database!");
        loadPlans();
      } else {
        showToast(data.error || "Errore durante il salvataggio", "error");
      }
    } catch {
      showToast("Errore di rete durante il salvataggio", "error");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-amber-200 text-xs leading-relaxed flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-300 mb-1">Importante sulla sincronizzazione con Stripe</p>
          <p>
            Modificare i crediti mensili inclusi di un tier si applicherà solo dai prossimi rinnovi per chi è già abbonato a quel tier (mai retroattivamente ai saldi già accreditati). Assicurati inoltre che il prezzo in centesimi di euro corrisponda ai tuoi Price ID configurati su Stripe Dashboard per evitare incongruenze al checkout.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Caricamento configurazione piani...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, idx) => (
              <div key={plan.tier} className="glass-card p-6 space-y-4 border-slate-800">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="text-sm font-black text-indigo-400 uppercase tracking-wider">{plan.tier}</span>
                  <span className="text-xs text-slate-400 font-mono">ID: {plan.tier}</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 font-semibold">Nome Visualizzato</label>
                    <input
                      type="text"
                      value={plan.name || ""}
                      onChange={(e) => handleFieldChange(idx, "name", e.target.value)}
                      className="input-field w-full text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1 font-semibold">Max Bambini</label>
                      <input
                        type="number"
                        min="1"
                        value={plan.max_children !== undefined ? plan.max_children : (plan.maxChildren ?? 1)}
                        onChange={(e) => handleFieldChange(idx, "max_children", parseInt(e.target.value, 10) || 1)}
                        className="input-field w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1 font-semibold">Crediti Mensili</label>
                      <input
                        type="number"
                        min="0"
                        value={plan.monthly_credits !== undefined ? plan.monthly_credits : (plan.monthlyCredits ?? 0)}
                        onChange={(e) => handleFieldChange(idx, "monthly_credits", parseInt(e.target.value, 10) || 0)}
                        className="input-field w-full text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1 font-semibold">Crediti Benvenuto</label>
                      <input
                        type="number"
                        min="0"
                        value={plan.welcome_credits !== undefined ? plan.welcome_credits : (plan.welcomeCredits ?? 0)}
                        onChange={(e) => handleFieldChange(idx, "welcome_credits", parseInt(e.target.value, 10) || 0)}
                        className="input-field w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1 font-semibold">Prezzo (Centesimi)</label>
                      <input
                        type="number"
                        min="0"
                        value={plan.price_monthly_cents !== undefined ? plan.price_monthly_cents : (plan.priceMonthlyCents ?? 0)}
                        onChange={(e) => handleFieldChange(idx, "price_monthly_cents", parseInt(e.target.value, 10) || 0)}
                        className="input-field w-full text-sm"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Es: 999 = €9.99</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1 font-semibold">Max Add-on per Famiglia</label>
                    <input
                      type="number"
                      min="0"
                      value={plan.addon_max_per_family !== undefined ? plan.addon_max_per_family : (plan.addonMaxPerFamily ?? 5)}
                      onChange={(e) => handleFieldChange(idx, "addon_max_per_family", parseInt(e.target.value, 10) || 0)}
                      className="input-field w-full text-sm"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={plan.all_morals !== undefined ? Boolean(plan.all_morals) : Boolean(plan.allMorals)}
                        onChange={(e) => handleFieldChange(idx, "all_morals", e.target.checked)}
                        className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-indigo-500"
                      />
                      Sblocca tutte le Morali Premium
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="btn-primary py-2.5 px-6 text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <Save className="w-4 h-4" />
              {saving ? "Salvataggio..." : "Salva Modifiche Piani"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==============================================================================
   TAB 2: AVATAR PRESETS
   ============================================================================== */
function AvatarPresetsTab({ showToast, confirmAction }: { showToast: any; confirmAction: (msg: string, cb: () => void) => void }) {
  const [presets, setPresets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const [formName, setFormName] = useState("");
  const [formImg, setFormImg] = useState("");
  const [formGender, setFormGender] = useState("neutral");
  const [formTarget, setFormTarget] = useState("child");
  const [formOrder, setFormOrder] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadPresets();
  }, []);

  async function loadPresets() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/avatar-presets");
      const data = await res.json();
      if (data.presets) setPresets(data.presets);
    } catch {
      showToast("Errore caricamento preset avatar", "error");
    }
    setLoading(false);
  }

  const handleOpenNew = () => {
    setEditingItem(null);
    setFormName("");
    setFormImg("");
    setFormGender("neutral");
    setFormTarget("child");
    setFormOrder(presets.length);
    setShowForm(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setFormName(item.name || "");
    setFormImg(item.image_url || "");
    setFormGender(item.gender || "neutral");
    setFormTarget(item.target_audience || "child");
    setFormOrder(item.display_order || 0);
    setShowForm(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setFormImg(data.publicUrl);
      showToast("Immagine caricata con successo!");
    } catch (error) {
      showToast("Errore durante l'upload dell'immagine", "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        const res = await fetch("/api/admin/avatar-presets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingItem.id,
            name: formName,
            image_url: formImg,
            gender: formGender,
            target_audience: formTarget,
            display_order: formOrder,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast("Preset avatar aggiornato con successo");
          setShowForm(false);
          loadPresets();
        } else showToast(data.error || "Errore aggiornamento", "error");
      } else {
        const res = await fetch("/api/admin/avatar-presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            image_url: formImg,
            gender: formGender,
            target_audience: formTarget,
            display_order: formOrder,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast("Nuovo preset avatar creato!");
          setShowForm(false);
          loadPresets();
        } else showToast(data.error || "Errore creazione", "error");
      }
    } catch {
      showToast("Errore di rete", "error");
    }
  };

  const handleDelete = async (id: string) => {
    confirmAction("Sei sicuro di voler eliminare questo preset avatar?", async () => {
      try {
        const res = await fetch(`/api/admin/avatar-presets?id=${id}`, { method: "DELETE" });
        if (res.ok) {
          showToast("Preset eliminato");
          loadPresets();
        } else showToast("Errore durante l'eliminazione", "error");
      } catch {
        showToast("Errore di rete", "error");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">Preset Avatar Disponibili</h2>
        <button onClick={handleOpenNew} className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nuovo Preset
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="glass-card p-5 space-y-4 border-indigo-500/40">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-indigo-400">{editingItem ? "Modifica Preset Avatar" : "Nuovo Preset Avatar"}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nome Preset</label>
              <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} className="input-field w-full text-sm" placeholder="Es: Volpe Magica" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">URL Immagine o Upload</label>
              <div className="flex gap-2">
                <input type="text" required value={formImg} onChange={(e) => setFormImg(e.target.value)} className="input-field flex-1 text-sm" placeholder="URL o Carica ->" />
                <label className="btn-primary py-2 px-3 text-xs flex items-center justify-center cursor-pointer relative overflow-hidden" style={{ minWidth: '90px' }}>
                  {uploadingImage ? "Caricamento..." : "Carica"}
                  <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploadingImage} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Genere</label>
                <select value={formGender} onChange={(e) => setFormGender(e.target.value)} className="input-field w-full text-sm">
                  <option value="neutral">Neutro</option>
                  <option value="boy">Maschio</option>
                  <option value="girl">Femmina</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Target</label>
                <select value={formTarget} onChange={(e) => setFormTarget(e.target.value)} className="input-field w-full text-sm">
                  <option value="child">Bambino</option>
                  <option value="parent">Genitore</option>
                  <option value="both">Entrambi</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ordine</label>
                <input type="number" value={formOrder} onChange={(e) => setFormOrder(parseInt(e.target.value, 10) || 0)} className="input-field w-full text-sm" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary py-2 px-4 text-xs">Annulla</button>
            <button type="submit" className="btn-primary py-2 px-4 text-xs">Salva Preset</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Caricamento preset...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {presets.map((item) => (
            <div key={item.id} className="glass-card p-3 flex flex-col items-center justify-between text-center relative group">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700/60 overflow-hidden mb-2 flex items-center justify-center">
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLImageElement).src = "/favicon.ico")} />
              </div>
              <span className="text-xs font-bold text-white truncate w-full">{item.name}</span>
              <span className="text-[10px] text-slate-400 uppercase mt-0.5">{item.gender} • T: {item.target_audience || 'child'} • Ord: {item.display_order}</span>
              <div className="flex items-center gap-1 mt-3 w-full justify-center pt-2 border-t border-slate-800">
                <button onClick={() => handleOpenEdit(item)} className="p-1.5 rounded hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition-colors" title="Modifica">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors" title="Elimina">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==============================================================================
   TAB 3: GAMIFICATION (BADGES & CORNICI) + MISSIONI
   ============================================================================== */
function GamificationTab({ showToast, confirmAction }: { showToast: any; confirmAction: (msg: string, cb: () => void) => void }) {
  const [missions, setMissions] = useState<any[]>([]);
  const [cosmetics, setCosmetics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showQuestForm, setShowQuestForm] = useState(false);
  const [editingQuest, setEditingQuest] = useState<any | null>(null);
  const [qTitle, setQTitle] = useState("");
  const [qCount, setQCount] = useState(1);
  const [qReward, setQReward] = useState(10);
  const [qDesc, setQDesc] = useState("");

  const [showCosmeticForm, setShowCosmeticForm] = useState(false);
  const [editingCosmetic, setEditingCosmetic] = useState<any | null>(null);
  const [cName, setCName] = useState("");
  const [cType, setCType] = useState("badge");
  const [cCost, setCCost] = useState(50);
  const [cIcon, setCIcon] = useState("🏆");
  const [cUnlockReq, setCUnlockReq] = useState("");
  const [cFrameColor, setCFrameColor] = useState("#ffffff");
  const [cFrameEffect, setCFrameEffect] = useState("solid");
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadGamification();
  }, []);

  async function loadGamification() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gamification");
      const data = await res.json();
      if (data.reading_quests) setMissions(data.reading_quests);
      if (data.cosmetic_items) setCosmetics(data.cosmetic_items);
    } catch {
      showToast("Errore caricamento gamification", "error");
    }
    setLoading(false);
  }

  // Quests handlers
  const handleSaveQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { title: qTitle, required_count: qCount, reward_points: qReward, description: qDesc };
      if (editingQuest) {
        const res = await fetch("/api/admin/gamification", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: "reading_quests", id: editingQuest.id, ...payload }),
        });
        if (res.ok) { showToast("Missione aggiornata"); setShowQuestForm(false); loadGamification(); }
      } else {
        const res = await fetch("/api/admin/gamification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: "reading_quests", ...payload }),
        });
        if (res.ok) { showToast("Missione creata"); setShowQuestForm(false); loadGamification(); }
      }
    } catch { showToast("Errore di rete", "error"); }
  };

  const handleDeleteMission = async (id: string) => {
    confirmAction("Eliminare questa missione di lettura?", async () => {
      try {
        const res = await fetch(`/api/admin/gamification?id=${id}&collection=missions`, { method: "DELETE" });
        if (res.ok) {
          showToast("Missione eliminata");
          loadGamification();
        } else showToast("Errore", "error");
      } catch {
        showToast("Errore rete", "error");
      }
    });
  };

  // Cosmetics handlers
  const handleUploadBadgeIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabaseClient = createClient();
      const ext = file.name.split('.').pop();
      const fileName = `badge_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseClient.storage.from("gamification").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabaseClient.storage.from("gamification").getPublicUrl(fileName);
      setCIcon(publicUrl);
      showToast("Immagine caricata con successo", "success");
    } catch {
      showToast("Errore caricamento immagine", "error");
    }
    setUploadingImage(false);
  };

  const handleSaveCosmetic = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { name: cName, type: cType, cost_points: cCost };
      if (cType === "badge") {
        payload.icon_value = cIcon;
        payload.unlock_requirement = cUnlockReq;
      } else {
        payload.frame_color = cFrameColor;
        payload.frame_effect = cFrameEffect;
      }

      if (editingCosmetic) {
        const res = await fetch("/api/admin/gamification", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: "cosmetic_items", id: editingCosmetic.id, ...payload }),
        });
        if (res.ok) { showToast("Cosmetico aggiornato"); setShowCosmeticForm(false); loadGamification(); }
      } else {
        const res = await fetch("/api/admin/gamification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: "cosmetic_items", ...payload }),
        });
        if (res.ok) { showToast("Cosmetico creato"); setShowCosmeticForm(false); loadGamification(); }
      }
    } catch { showToast("Errore di rete", "error"); }
  };

  const handleDeleteCosmetic = async (id: string) => {
    confirmAction("Eliminare questo elemento cosmetico?", async () => {
      try {
        const res = await fetch(`/api/admin/gamification?id=${id}&collection=cosmetics`, { method: "DELETE" });
        if (res.ok) {
          showToast("Elemento eliminato");
          loadGamification();
        } else showToast("Errore", "error");
      } catch {
        showToast("Errore rete", "error");
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Colonna 1: Missioni di Lettura */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Missioni Lettura
          </h3>
          <button
            onClick={() => { setEditingQuest(null); setQTitle(""); setQCount(1); setQReward(10); setQDesc(""); setShowQuestForm(true); }}
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Nuova Missione
          </button>
        </div>

        {showQuestForm && (
          <form onSubmit={handleSaveQuest} className="glass-card p-4 space-y-3 border-amber-500/40">
            <h4 className="text-xs font-bold text-amber-300">{editingQuest ? "Modifica Missione" : "Nuova Missione"}</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400">Titolo</label>
                <input type="text" required value={qTitle} onChange={(e) => setQTitle(e.target.value)} className="input-field w-full text-xs" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400">Storie Richieste</label>
                <input type="number" required min="1" value={qCount} onChange={(e) => setQCount(parseInt(e.target.value, 10) || 1)} className="input-field w-full text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400">Ricompensa (Punti)</label>
                <input type="number" required min="0" value={qReward} onChange={(e) => setQReward(parseInt(e.target.value, 10) || 0)} className="input-field w-full text-xs" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400">Descrizione (Opz.)</label>
                <input type="text" value={qDesc} onChange={(e) => setQDesc(e.target.value)} className="input-field w-full text-xs" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowQuestForm(false)} className="btn-secondary py-1 px-3 text-xs">Annulla</button>
              <button type="submit" className="btn-primary py-1 px-3 text-xs">Salva</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-6 text-slate-500 text-xs">Caricamento...</div>
        ) : missions.length === 0 ? (
          <div className="glass-card p-6 text-center text-slate-500 text-xs">Nessuna missione presente.</div>
        ) : (
          <div className="space-y-2">
            {missions.map((q) => (
              <div key={q.id} className="glass-card p-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white">{q.title}</h4>
                  <p className="text-[11px] text-slate-400">Leggi {q.required_count} storie • Ricompensa: +{q.reward_points} Punti Avventura</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditingQuest(q); setQTitle(q.title); setQCount(q.required_count); setQReward(q.reward_points); setQDesc(q.description || ""); setShowQuestForm(true); }} className="p-1.5 rounded hover:bg-slate-800 text-indigo-400">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteMission(q.id)} className="p-1.5 rounded hover:bg-slate-800 text-rose-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Colonna 2: Elementi Cosmetici (Badge & Cornici) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" /> Badge & Cornici
          </h3>
          <button
            onClick={() => { 
              setEditingCosmetic(null); 
              setCName(""); 
              setCType("badge"); 
              setCCost(50); 
              setCIcon("🏆"); 
              setCUnlockReq("");
              setCFrameColor("#ffffff");
              setCFrameEffect("solid");
              setShowCosmeticForm(true); 
            }}
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Nuovo Cosmetico
          </button>
        </div>

        {showCosmeticForm && (
          <form onSubmit={handleSaveCosmetic} className={`glass-card p-4 space-y-4 border-${cType === 'badge' ? 'indigo' : 'amber'}-500/40`}>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white">{editingCosmetic ? "Modifica Cosmetico" : "Nuovo Cosmetico"}</h4>
            </div>
            
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 space-y-2">
              <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Seleziona Tipo</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setCType("badge")} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${cType === "badge" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>Badge</button>
                <button type="button" onClick={() => setCType("frame")} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${cType === "frame" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-400"}`}>Cornice</button>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight mt-2">
                <strong className="text-slate-300">Differenza:</strong> I Badge sono icone (o immagini) guadagnate che si affiancano al nome. Le Cornici sono anelli colorati/con effetti applicati attorno all'Avatar.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Nome</label>
                <input type="text" required value={cName} onChange={(e) => setCName(e.target.value)} className="input-field w-full text-xs" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Costo Punti</label>
                <input type="number" required min="0" value={cCost} onChange={(e) => setCCost(parseInt(e.target.value, 10) || 0)} className="input-field w-full text-xs" />
              </div>
            </div>

            {cType === "badge" ? (
              <div className="space-y-3 bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
                <div>
                  <label className="block text-[10px] text-indigo-300/70 mb-1">Requisito Missione (Opzionale)</label>
                  <input type="text" value={cUnlockReq} onChange={(e) => setCUnlockReq(e.target.value)} className="input-field w-full text-xs" placeholder="es. Completa 5 letture" />
                </div>
                <div>
                  <label className="block text-[10px] text-indigo-300/70 mb-1">Icona (Emoji o URL)</label>
                  <div className="flex gap-2">
                    <input type="text" required value={cIcon} onChange={(e) => setCIcon(e.target.value)} className="input-field w-full text-xs" placeholder="🏆 o https://..." />
                    <label className="btn-secondary py-1.5 px-3 text-xs cursor-pointer flex items-center justify-center min-w-max">
                      {uploadingImage ? "..." : "Upload"}
                      <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={handleUploadBadgeIcon} disabled={uploadingImage} />
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-amber-300/70 mb-1">Colore Cornice (HEX)</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={cFrameColor} onChange={(e) => setCFrameColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-slate-900 border-0 p-0" />
                      <input type="text" value={cFrameColor} onChange={(e) => setCFrameColor(e.target.value)} className="input-field flex-1 text-xs font-mono" placeholder="#ffffff" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-amber-300/70 mb-1">Effetto Speciale</label>
                    <select value={cFrameEffect} onChange={(e) => setCFrameEffect(e.target.value)} className="input-field w-full text-xs">
                      <option value="solid">Tinta Unita (Solid)</option>
                      <option value="glow">Bagliore (Glow)</option>
                      <option value="sparkling">Brillantini (Sparkling)</option>
                      <option value="flame">Fiamma (Flame)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setShowCosmeticForm(false)} className="btn-secondary py-1.5 px-4 text-xs">Annulla</button>
              <button type="submit" disabled={uploadingImage} className="btn-primary py-1.5 px-4 text-xs">{editingCosmetic ? "Salva Modifiche" : "Crea Cosmetico"}</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-6 text-slate-500 text-xs">Caricamento...</div>
        ) : cosmetics.length === 0 ? (
          <div className="glass-card p-6 text-center text-slate-500 text-xs">Nessun elemento cosmetico presente.</div>
        ) : (
          <div className="space-y-2">
            {cosmetics.map((c) => (
              <div key={c.id} className="glass-card p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{c.icon_value}</span>
                  <div>
                    <h4 className="text-xs font-bold text-white">{c.name}</h4>
                    <span className="text-[10px] uppercase font-bold text-indigo-400">{c.type}</span> • <span className="text-[10px] text-slate-400">Costo: {c.cost_points} Punti</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { 
                    setEditingCosmetic(c); 
                    setCName(c.name); 
                    setCType(c.type); 
                    setCCost(c.cost_points); 
                    setCIcon(c.icon_value); 
                    setCUnlockReq(c.unlock_requirement || "");
                    setCFrameColor(c.frame_color || "#ffffff");
                    setCFrameEffect(c.frame_effect || "solid");
                    setShowCosmeticForm(true); 
                  }} className="p-1.5 rounded hover:bg-slate-800 text-indigo-400">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteCosmetic(c.id)} className="p-1.5 rounded hover:bg-slate-800 text-rose-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==============================================================================
   TAB 4: MORALI PREDEFINITE
   ============================================================================== */
function MoralsTab({ showToast, confirmAction }: { showToast: any; confirmAction: (msg: string, cb: () => void) => void }) {
  const [morals, setMorals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("General");
  const [minAge, setMinAge] = useState(3);
  const [maxAge, setMaxAge] = useState(12);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    loadMorals();
  }, []);

  async function loadMorals() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/morals");
      const data = await res.json();
      if (data.morals) setMorals(data.morals);
    } catch { showToast("Errore caricamento morali", "error"); }
    setLoading(false);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { title, description: desc, category, min_age: minAge, max_age: maxAge, is_premium: isPremium };
      if (editingItem) {
        const res = await fetch("/api/admin/morals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingItem.id, ...payload }),
        });
        if (res.ok) { showToast("Morale aggiornata"); setShowForm(false); loadMorals(); }
      } else {
        const res = await fetch("/api/admin/morals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) { showToast("Morale creata"); setShowForm(false); loadMorals(); }
      }
    } catch { showToast("Errore di rete", "error"); }
  };

  const handleDelete = async (id: string) => {
    confirmAction("Eliminare questa morale predefinita?", async () => {
      try {
        const res = await fetch(`/api/admin/morals?id=${id}`, { method: "DELETE" });
        if (res.ok) {
          showToast("Morale eliminata");
          loadMorals();
        } else showToast("Errore", "error");
      } catch {
        showToast("Errore rete", "error");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">Morali Predefinite nel Cestino Favole</h2>
        <button
          onClick={() => { setEditingItem(null); setTitle(""); setDesc(""); setCategory("General"); setMinAge(3); setMaxAge(12); setIsPremium(false); setShowForm(true); }}
          className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Nuova Morale
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="glass-card p-5 space-y-4 border-indigo-500/40">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-indigo-400">{editingItem ? "Modifica Morale" : "Nuova Morale"}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Titolo Morale</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="input-field w-full text-sm" placeholder="Es: L'importanza della Condivisione" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Categoria</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className="input-field w-full text-sm" placeholder="Es: Sociale / Coraggio" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Descrizione</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="input-field w-full text-sm" placeholder="Spiegazione o prompt aggiuntivo..." />
          </div>
          <div className="grid grid-cols-3 gap-4 items-center">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Età Minima</label>
              <input type="number" min="1" value={minAge} onChange={(e) => setMinAge(parseInt(e.target.value, 10) || 1)} className="input-field w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Età Massima</label>
              <input type="number" min="1" value={maxAge} onChange={(e) => setMaxAge(parseInt(e.target.value, 10) || 12)} className="input-field w-full text-sm" />
            </div>
            <div className="pt-5">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-indigo-500" />
                Solo Piano Premium/Family
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary py-2 px-4 text-xs">Annulla</button>
            <button type="submit" className="btn-primary py-2 px-4 text-xs">Salva</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Caricamento morali...</div>
      ) : morals.length === 0 ? (
        <div className="glass-card p-8 text-center text-slate-500 text-sm">Nessuna morale presente.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {morals.map((m) => (
            <div key={m.id} className="glass-card p-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">{m.title}</h3>
                  {m.is_premium && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 uppercase">PREMIUM</span>}
                </div>
                <p className="text-xs text-slate-300">{m.description || "Nessuna descrizione"}</p>
                <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-3">
                  <span>Categoria: <strong>{m.category}</strong></span>
                  <span>Età: <strong>{m.min_age}-{m.max_age} anni</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { setEditingItem(m); setTitle(m.title); setDesc(m.description || ""); setCategory(m.category || "General"); setMinAge(m.min_age || 3); setMaxAge(m.max_age || 12); setIsPremium(m.is_premium || false); setShowForm(true); }} className="p-1.5 rounded hover:bg-slate-800 text-indigo-400">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-slate-800 text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==============================================================================
   TAB 5: STORIE PRESET
   ============================================================================== */
function PresetStoriesTab({ showToast, confirmAction }: { showToast: any; confirmAction: (msg: string, cb: () => void) => void }) {
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [ageGroup, setAgeGroup] = useState("3-5");

  useEffect(() => {
    loadStories();
  }, []);

  async function loadStories() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/preset-stories");
      const data = await res.json();
      if (data.preset_stories) setStories(data.preset_stories);
    } catch { showToast("Errore caricamento storie preset", "error"); }
    setLoading(false);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { title, summary, content, age_group: ageGroup };
      if (editingItem) {
        const res = await fetch("/api/admin/preset-stories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingItem.id, ...payload }),
        });
        if (res.ok) { showToast("Storia preset aggiornata"); setShowForm(false); loadStories(); }
      } else {
        const res = await fetch("/api/admin/preset-stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) { showToast("Nuova storia preset creata!"); setShowForm(false); loadStories(); }
      }
    } catch { showToast("Errore di rete", "error"); }
  };

  const handleDelete = async (id: string) => {
    confirmAction("Eliminare questa storia preset?", async () => {
      try {
        const res = await fetch(`/api/admin/preset-stories?id=${id}`, { method: "DELETE" });
        if (res.ok) {
          showToast("Storia eliminata");
          loadStories();
        } else showToast("Errore eliminazione", "error");
      } catch {
        showToast("Errore rete", "error");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">Libreria Storie Preset (Esplora / Accesso Gratuito)</h2>
        <button
          onClick={() => { setEditingItem(null); setTitle(""); setSummary(""); setContent(""); setAgeGroup("3-5"); setShowForm(true); }}
          className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Nuova Storia Preset
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="glass-card p-5 space-y-4 border-indigo-500/40">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-indigo-400">{editingItem ? "Modifica Storia Preset" : "Nuova Storia Preset"}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Titolo Favola</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="input-field w-full text-sm" placeholder="Es: Il Drago gentile di Valle Fiorita" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fascia d'età</label>
              <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="input-field w-full text-sm">
                <option value="3-5">3-5 anni</option>
                <option value="6-8">6-8 anni</option>
                <option value="9-12">9-12 anni</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sintesi Breve (Summary)</label>
            <input type="text" required value={summary} onChange={(e) => setSummary(e.target.value)} className="input-field w-full text-sm" placeholder="Una breve introduzione per la card..." />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Contenuto della Favola</label>
            <textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="input-field w-full text-sm font-mono" placeholder="C'era una volta..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary py-2 px-4 text-xs">Annulla</button>
            <button type="submit" className="btn-primary py-2 px-4 text-xs">Salva Storia Preset</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Caricamento storie preset...</div>
      ) : stories.length === 0 ? (
        <div className="glass-card p-8 text-center text-slate-500 text-sm">Nessuna storia preset presente.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stories.map((s) => (
            <div key={s.id} className="glass-card p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300">Età {s.age_group}</span>
                  <span className="text-[10px] text-slate-500">{new Date(s.created_at || Date.now()).toLocaleDateString("it-IT")}</span>
                </div>
                <h3 className="text-base font-bold text-white">{s.title}</h3>
                <p className="text-xs text-slate-300 line-clamp-2">{s.summary}</p>
              </div>
              <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-800">
                <button onClick={() => { setEditingItem(s); setTitle(s.title); setSummary(s.summary || ""); setContent(s.content || ""); setAgeGroup(s.age_group || "3-5"); setShowForm(true); }} className="p-1.5 rounded hover:bg-slate-800 text-indigo-400">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-slate-800 text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==============================================================================
   TAB 6: FIXED TEXTS (COPY APPLICATIVO)
   ============================================================================== */
function FixedTextsTab({ showToast }: { showToast: (msg: string, type?: "success" | "error") => void }) {
  const [texts, setTexts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTexts();
  }, []);

  async function loadTexts() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/fixed-texts");
      const data = await res.json();
      if (data.fixed_texts) setTexts(data.fixed_texts);
    } catch { showToast("Errore caricamento testi fissi", "error"); }
    setLoading(false);
  }

  const handleChange = (idx: number, val: string) => {
    const updated = [...texts];
    updated[idx].content = val;
    setTexts(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fixed-texts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixed_texts: texts }),
      });
      if (res.ok) showToast("Testi fissi aggiornati con successo!");
      else showToast("Errore di salvataggio", "error");
    } catch { showToast("Errore di rete", "error"); }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">Testi Fissi & Banner di Copy</h2>
        <button onClick={handleSave} disabled={saving} className="btn-primary py-2 px-6 text-xs flex items-center gap-2">
          <Save className="w-4 h-4" /> {saving ? "Salvataggio..." : "Salva Testi"}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Caricamento testi...</div>
      ) : (
        <div className="space-y-4">
          {texts.map((item, idx) => (
            <div key={item.key} className="glass-card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 font-mono">{item.key}</span>
                <span className="text-[11px] text-slate-400">{item.description}</span>
              </div>
              <textarea
                value={item.content}
                onChange={(e) => handleChange(idx, e.target.value)}
                rows={2}
                className="input-field w-full text-sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==============================================================================
   TAB 7: CONFIGURAZIONE APP & MODELLI AI (CON TENDINA <SELECT>)
   ============================================================================== */
function AppConfigTab({ showToast }: { showToast: (msg: string, type?: "success" | "error") => void }) {
  const [params, setParams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadParams();
  }, []);

  async function loadParams() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/app-config");
      const data = await res.json();
      if (data.app_config) setParams(data.app_config);
    } catch { showToast("Errore caricamento configurazione app", "error"); }
    setLoading(false);
  }

  const handleChange = (idx: number, val: any) => {
    const updated = [...params];
    updated[idx].value = val;
    setParams(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/app-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_config: params }),
      });
      const data = await res.json();
      if (res.ok && data.success) showToast("Configurazione applicativa salvata con successo!");
      else showToast(data.error || "Errore durante il salvataggio", "error");
    } catch { showToast("Errore di rete", "error"); }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Parametri Globali & Modelli Gemini</h2>
          <p className="text-xs text-slate-400 mt-0.5">I modelli Gemini sono protetti da un menu a tendina predefinito per prevenire errori di battitura in produzione.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary py-2 px-6 text-xs flex items-center gap-2">
          <Save className="w-4 h-4" /> {saving ? "Salvataggio..." : "Salva Configurazione"}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Caricamento parametri...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {params.map((item, idx) => {
            const isAiModel = item.key === "ai_default_model" || item.key === "ai_fallback_model";
            let rawVal = item.value;
            if (typeof rawVal === "string" && rawVal.startsWith('"') && rawVal.endsWith('"')) {
              try { rawVal = JSON.parse(rawVal); } catch { /* tieni string */ }
            }

            return (
              <div key={item.key} className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-400 font-mono">{item.key}</span>
                  {isAiModel && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300">MODELLO AI</span>}
                </div>
                <p className="text-xs text-slate-400">{item.description || "Parametro di sistema"}</p>

                {isAiModel ? (
                  <select
                    value={typeof rawVal === "string" ? rawVal : "gemini-2.5-flash"}
                    onChange={(e) => handleChange(idx, JSON.stringify(e.target.value))}
                    className="input-field w-full text-sm font-semibold text-indigo-300"
                  >
                    {VALID_GEMINI_MODELS.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={typeof rawVal === "object" ? JSON.stringify(rawVal) : rawVal}
                    onChange={(e) => {
                      const val = e.target.value;
                      let parsed: any = val;
                      if (!isNaN(Number(val)) && val !== "") parsed = Number(val);
                      handleChange(idx, parsed);
                    }}
                    className="input-field w-full text-sm font-mono"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==============================================================================
   TAB 8: CONTENT REPORTS (SEGNALAZIONI CONTENUTO)
   ============================================================================== */
function getStatusBadge(status: string) {
  if (status === "resolved" || status === "reviewed") {
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Esaminata</span>;
  }
  if (status === "dismissed" || status === "archived") {
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">Archiviata</span>;
  }
  return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">In Attesa</span>;
}

function ContentReportsTab({ showToast }: { showToast: (msg: string, type?: "success" | "error") => void }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/content-reports", {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.reports) setReports(data.reports);
    } catch {
      showToast("Errore durante il caricamento delle segnalazioni", "error");
    }
    setLoading(false);
  }

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/content-reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Stato segnalazione aggiornato in ${newStatus}`);
        loadReports();
      } else {
        showToast(data.error || "Errore aggiornamento", "error");
      }
    } catch {
      showToast("Errore di rete", "error");
    }
  };

  const getCategoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      inappropriate_theme: "Tema spaventoso/inadatto",
      bad_language: "Linguaggio improprio/violento",
      moral_inconsistency: "Morale incoerente",
      technical_defect: "Difetto tecnico/tronco",
      other: "Altro",
    };
    return map[cat] || cat;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" /> Segnalazioni Ricevute
        </h2>
        <button onClick={loadReports} className="btn-secondary py-1.5 px-3 text-xs">
          Aggiorna
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Caricamento segnalazioni...</div>
      ) : reports.length === 0 ? (
        <div className="glass-card p-8 text-center text-slate-400 text-sm">
          Nessuna segnalazione presente nel database.
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => {
            const storyText = r.stories?.generated_text || "Testo non disponibile";
            const storyTitle = storyText.split("\n")[0]?.replace(/^#\s*/, "") || "Storia";
            const excerpt = storyText.slice(0, 200) + (storyText.length > 200 ? "..." : "");

            return (
              <div key={r.id} className="glass-card p-5 space-y-4 border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    {getStatusBadge(r.status)}
                    <span className="ml-3 text-xs font-bold text-amber-400">{getCategoryLabel(r.reason_category)}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {r.id.slice(0, 8)}... • {new Date(r.created_at).toLocaleString("it-IT")}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">Dettagli Segnalazione</div>
                    <div className="text-slate-400"><strong>Motivo:</strong> {getCategoryLabel(r.reason_category)}</div>
                    {r.details && (
                      <div className="text-slate-300 mt-1 italic">&ldquo;{r.details}&rdquo;</div>
                    )}
                    <div className="text-slate-500 text-[10px] pt-1">Famiglia ID: {r.reported_by_family_id}</div>
                  </div>

                  <div className="space-y-1 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">Estratto Storia (Età: {r.stories?.target_age_range || "N/A"})</div>
                    <div className="font-bold text-indigo-300 mb-2">{storyTitle}</div>
                    <details className="text-slate-400 text-[11px] leading-relaxed group">
                      <summary className="cursor-pointer font-semibold text-indigo-400 hover:text-indigo-300 transition-colors mb-1">
                        Leggi testo completo
                      </summary>
                      <div className="mt-2 p-3 bg-slate-950 rounded-lg border border-slate-800 whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">
                        {storyText}
                      </div>
                    </details>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                  {r.status !== "reviewed" && (
                    <button
                      onClick={() => handleUpdateStatus(r.id, "reviewed")}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Segna come Esaminata
                    </button>
                  )}
                  {r.status !== "dismissed" && (
                    <button
                      onClick={() => handleUpdateStatus(r.id, "dismissed")}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                    >
                      Archivia (Dismiss)
                    </button>
                  )}
                  {r.status !== "pending" && (
                    <button
                      onClick={() => handleUpdateStatus(r.id, "pending")}
                      className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-xs transition-colors"
                    >
                      Rimetti in Attesa
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==============================================================================
   TAB 9: NARRATIVE CATALOG (Temi & Luoghi)
   ============================================================================== */
function NarrativeCatalogTab({ showToast, confirmAction }: { showToast: any; confirmAction: (msg: string, cb: () => void) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "CHARACTER_TRAIT" | "SETTING_THEME" | "STORY_STYLE">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const [cName, setCName] = useState("");
  const [cType, setCType] = useState("CHARACTER_TRAIT");
  const [cDesc, setCDesc] = useState("");
  const [cCost, setCCost] = useState(40);
  const [cIcon, setCIcon] = useState("star");
  const [cRequiresPlan, setCRequiresPlan] = useState("free");

  useEffect(() => {
    loadContent();
  }, []);

  async function loadContent() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/narrative-content");
      const data = await res.json();
      if (data.narrative_content) setItems(data.narrative_content);
    } catch { showToast("Errore caricamento contenuti narrativi", "error"); }
    setLoading(false);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: cName,
        content_type: cType,
        description: cDesc,
        cost_points: cCost,
        icon_preset: cIcon,
        requires_plan: cRequiresPlan,
        is_active: true
      };
      if (editingItem) {
        const res = await fetch("/api/admin/narrative-content", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingItem.id, ...payload }),
        });
        if (res.ok) { showToast("Contenuto aggiornato"); setShowForm(false); loadContent(); }
      } else {
        const res = await fetch("/api/admin/narrative-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) { showToast("Contenuto creato"); setShowForm(false); loadContent(); }
      }
    } catch { showToast("Errore di rete", "error"); }
  };

  const handleDelete = async (id: string) => {
    confirmAction("Eliminare questo contenuto narrativo?", async () => {
      try {
        const res = await fetch(`/api/admin/narrative-content?id=${id}`, { method: "DELETE" });
        if (res.ok) {
          showToast("Contenuto eliminato");
          loadContent();
        } else showToast("Errore eliminazione", "error");
      } catch {
        showToast("Errore di rete", "error");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Book className="w-5 h-5 text-indigo-400" /> Contenuti Narrativi
        </h2>
        <button
          onClick={() => {
            setEditingItem(null); setCName(""); setCType("CHARACTER_TRAIT"); setCDesc(""); setCCost(40); setCIcon("star"); setCRequiresPlan("free"); setShowForm(true);
          }}
          className="btn-primary py-2 px-4 text-xs flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nuovo Contenuto
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">{editingItem ? "Modifica Contenuto" : "Nuovo Contenuto"}</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nome / Titolo</label>
              <input type="text" required value={cName} onChange={(e) => setCName(e.target.value)} className="input-field w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo di Contenuto</label>
              <select value={cType} onChange={(e) => setCType(e.target.value)} className="input-field w-full text-sm">
                <option value="CHARACTER_TRAIT">Tratto Personaggio</option>
                <option value="SETTING_THEME">Tema Ambientazione</option>
                <option value="STORY_STYLE">Stile Storia</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Descrizione Lunga (Wizard)</label>
            <textarea required value={cDesc} onChange={(e) => setCDesc(e.target.value)} rows={3} className="input-field w-full text-sm" placeholder="Spiega al bambino cosa fa questo contenuto..." />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Costo in Punti</label>
              <input type="number" required min="0" value={cCost} onChange={(e) => setCCost(parseInt(e.target.value, 10) || 0)} className="input-field w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Icona (lucide-react / preset)</label>
              <input type="text" required value={cIcon} onChange={(e) => setCIcon(e.target.value)} className="input-field w-full text-sm" placeholder="star" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Piano Richiesto</label>
              <select value={cRequiresPlan} onChange={(e) => setCRequiresPlan(e.target.value)} className="input-field w-full text-sm">
                <option value="free">Gratuito</option>
                <option value="premium">Premium</option>
                <option value="family">Family</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary py-2 px-4 text-xs">Annulla</button>
            <button type="submit" className="btn-primary py-2 px-4 text-xs">Salva Contenuto</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Caricamento contenuti...</div>
      ) : items.length === 0 ? (
        <div className="glass-card p-8 text-center text-slate-500 text-sm">Nessun contenuto narrativo presente.</div>
      ) : (
        <>
          <div className="flex gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto custom-scrollbar">
            {(["all", "STORY_STYLE", "CHARACTER_TRAIT", "SETTING_THEME"] as const).map((filterVal) => {
              const labels: Record<string, string> = {
                all: "Tutti",
                STORY_STYLE: "Stili",
                CHARACTER_TRAIT: "Tratti",
                SETTING_THEME: "Ambientazioni",
              };
              return (
                <button
                  key={filterVal}
                  onClick={() => setFilterType(filterVal)}
                  className={`flex-1 min-w-max px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterType === filterVal
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {labels[filterVal]}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.filter(item => filterType === "all" || item.content_type === filterType).map((item) => (
            <div key={item.id} className="glass-card p-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-bold text-white">{item.name}</h4>
                  <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{item.content_type}</span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mb-2">{item.description}</p>
                <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                  <span className="text-amber-300">{item.cost_points} Punti</span>
                  <span className="capitalize">{item.requires_plan}</span>
                  <span className="font-mono text-slate-400">icon: {item.icon_preset}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { setEditingItem(item); setCName(item.name); setCType(item.content_type); setCDesc(item.description); setCCost(item.cost_points || 40); setCIcon(item.icon_preset); setCRequiresPlan(item.requires_plan || "free"); setShowForm(true); }} className="p-2 rounded hover:bg-slate-800 text-indigo-400">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-2 rounded hover:bg-slate-800 text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ==============================================================================
   TAB 10: GIFT CODES
   ============================================================================== */
function GiftCodesTab({ showToast }: { showToast: (msg: string, type?: "success" | "error") => void }) {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [newType, setNewType] = useState("credits");
  const [newAmountOrTier, setNewAmountOrTier] = useState("10");
  const [newDurationMonths, setNewDurationMonths] = useState("12");
  const [newNotes, setNewNotes] = useState("");

  useEffect(() => {
    loadCodes();
  }, []);

  async function loadCodes() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gift-codes");
      const data = await res.json();
      if (data.codes) setCodes(data.codes);
    } catch {
      showToast("Errore durante il caricamento dei gift code", "error");
    }
    setLoading(false);
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/gift-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: newType, 
          amount_or_tier: newAmountOrTier, 
          duration_months: newType === "subscription" ? parseInt(newDurationMonths, 10) : undefined,
          notes: newNotes 
        }),
      });
      const data = await res.json();
      if (res.ok && data.giftCode) {
        showToast("Gift Code generato con successo!");
        setNewNotes("");
        loadCodes();
      } else {
        showToast(data.error || "Errore durante la generazione", "error");
      }
    } catch {
      showToast("Errore di rete durante la generazione", "error");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <Gift className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Genera Nuovo Gift Code</h2>
            <p className="text-sm text-slate-400">Crea un codice regalo manuale attivo da inviare agli utenti.</p>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">Tipo</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200"
            >
              <option value="credits">Crediti AI</option>
              <option value="subscription">Abbonamento</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">
              {newType === "credits" ? "Quantità" : "Piano (es. premium)"}
            </label>
            <input
              type="text"
              value={newAmountOrTier}
              onChange={(e) => setNewAmountOrTier(e.target.value)}
              placeholder={newType === "credits" ? "es. 10" : "es. premium"}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200"
              required
            />
          </div>

          {newType === "subscription" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Durata (Mesi)</label>
              <input
                type="number"
                min="1"
                value={newDurationMonths}
                onChange={(e) => setNewDurationMonths(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200"
                required
              />
            </div>
          )}

          <div className={`space-y-1 ${newType === "credits" ? "md:col-span-2" : "md:col-span-1"}`}>
            <label className="text-xs font-semibold text-slate-400 uppercase">Note (opzionale)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="es. Regalo per contest di Natale"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200"
              />
              <button
                type="submit"
                disabled={saving}
                className="btn-primary shrink-0 py-2 px-6 flex items-center gap-2"
              >
                {saving ? "Generazione..." : <><Plus className="w-4 h-4" /> Genera</>}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl">
        <h2 className="text-xl font-bold mb-4">Storico Gift Codes</h2>
        {loading ? (
          <p className="text-slate-400 text-sm">Caricamento...</p>
        ) : codes.length === 0 ? (
          <p className="text-slate-400 text-sm">Nessun gift code generato finora.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Codice</th>
                  <th className="py-3 px-4">Tipo / Entità</th>
                  <th className="py-3 px-4">Stato</th>
                  <th className="py-3 px-4">Note / Creazione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {codes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-300">
                      {c.code}
                    </td>
                    <td className="py-3 px-4">
                      {c.type === "credits" ? `${c.amount_or_tier} Crediti` : `Piano ${c.amount_or_tier.toUpperCase()}`}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs border ${
                        c.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                        c.status === "redeemed" ? "bg-slate-800 text-slate-400 border-slate-700" :
                        "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      }`}>
                        {c.status.toUpperCase()}
                      </span>
                      {c.status === "redeemed" && c.redeemed_at && (
                        <div className="text-[10px] text-slate-500 mt-1">
                          il {new Date(c.redeemed_at).toLocaleDateString("it-IT")}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-[200px] truncate">
                      {c.notes || "Nessuna nota"}
                      <div className="text-[10px] text-slate-500 mt-1">
                        Creato: {new Date(c.created_at).toLocaleDateString("it-IT")}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
