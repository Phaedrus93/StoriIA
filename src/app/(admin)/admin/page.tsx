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
} from "lucide-react";

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
          { id: "gamification", label: "Gamification", icon: Trophy },
          { id: "morals", label: "Morali Predefinite", icon: BookOpen },
          { id: "stories", label: "Storie Preset", icon: FileText },
          { id: "texts", label: "Testi Fissi (Copy)", icon: MessageSquare },
          { id: "config", label: "Parametri App & AI", icon: Settings },
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
      {activeTab === "avatars" && <AvatarPresetsTab showToast={showToast} />}
      {activeTab === "gamification" && <GamificationTab showToast={showToast} />}
      {activeTab === "morals" && <MoralsTab showToast={showToast} />}
      {activeTab === "stories" && <PresetStoriesTab showToast={showToast} />}
      {activeTab === "texts" && <FixedTextsTab showToast={showToast} />}
      {activeTab === "config" && <AppConfigTab showToast={showToast} />}
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
function AvatarPresetsTab({ showToast }: { showToast: (msg: string, type?: "success" | "error") => void }) {
  const [presets, setPresets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const [formName, setFormName] = useState("");
  const [formImg, setFormImg] = useState("");
  const [formGender, setFormGender] = useState("neutral");
  const [formOrder, setFormOrder] = useState(0);

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
    setFormOrder(presets.length);
    setShowForm(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setFormName(item.name || "");
    setFormImg(item.image_url || "");
    setFormGender(item.gender || "neutral");
    setFormOrder(item.display_order || 0);
    setShowForm(true);
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
    if (!confirm("Sei sicuro di voler eliminare questo preset avatar?")) return;
    try {
      const res = await fetch(`/api/admin/avatar-presets?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Preset eliminato");
        loadPresets();
      } else showToast("Errore durante l'eliminazione", "error");
    } catch {
      showToast("Errore di rete", "error");
    }
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
              <label className="block text-xs text-slate-400 mb-1">URL Immagine</label>
              <input type="text" required value={formImg} onChange={(e) => setFormImg(e.target.value)} className="input-field w-full text-sm" placeholder="/avatars/fox.png o URL" />
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
              <span className="text-[10px] text-slate-400 uppercase mt-0.5">{item.gender} • Ord: {item.display_order}</span>
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
   TAB 3: GAMIFICATION (READING QUESTS + COSMETIC ITEMS)
   ============================================================================== */
function GamificationTab({ showToast }: { showToast: (msg: string, type?: "success" | "error") => void }) {
  const [quests, setQuests] = useState<any[]>([]);
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

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gamification");
      const data = await res.json();
      if (data.reading_quests) setQuests(data.reading_quests);
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
        if (res.ok) { showToast("Missione aggiornata"); setShowQuestForm(false); loadAll(); }
      } else {
        const res = await fetch("/api/admin/gamification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: "reading_quests", ...payload }),
        });
        if (res.ok) { showToast("Missione creata"); setShowQuestForm(false); loadAll(); }
      }
    } catch { showToast("Errore di rete", "error"); }
  };

  const handleDeleteQuest = async (id: string) => {
    if (!confirm("Eliminare questa missione di lettura?")) return;
    try {
      const res = await fetch(`/api/admin/gamification?table=reading_quests&id=${id}`, { method: "DELETE" });
      if (res.ok) { showToast("Missione eliminata"); loadAll(); }
    } catch { showToast("Errore di rete", "error"); }
  };

  // Cosmetics handlers
  const handleSaveCosmetic = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { name: cName, type: cType, cost_points: cCost, icon_value: cIcon };
      if (editingCosmetic) {
        const res = await fetch("/api/admin/gamification", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: "cosmetic_items", id: editingCosmetic.id, ...payload }),
        });
        if (res.ok) { showToast("Cosmetico aggiornato"); setShowCosmeticForm(false); loadAll(); }
      } else {
        const res = await fetch("/api/admin/gamification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: "cosmetic_items", ...payload }),
        });
        if (res.ok) { showToast("Cosmetico creato"); setShowCosmeticForm(false); loadAll(); }
      }
    } catch { showToast("Errore di rete", "error"); }
  };

  const handleDeleteCosmetic = async (id: string) => {
    if (!confirm("Eliminare questo elemento cosmetico?")) return;
    try {
      const res = await fetch(`/api/admin/gamification?table=cosmetic_items&id=${id}`, { method: "DELETE" });
      if (res.ok) { showToast("Cosmetico eliminato"); loadAll(); }
    } catch { showToast("Errore di rete", "error"); }
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
        ) : quests.length === 0 ? (
          <div className="glass-card p-6 text-center text-slate-500 text-xs">Nessuna missione presente.</div>
        ) : (
          <div className="space-y-2">
            {quests.map((q) => (
              <div key={q.id} className="glass-card p-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white">{q.title}</h4>
                  <p className="text-[11px] text-slate-400">Leggi {q.required_count} storie • Ricompensa: +{q.reward_points} Punti Avventura</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditingQuest(q); setQTitle(q.title); setQCount(q.required_count); setQReward(q.reward_points); setQDesc(q.description || ""); setShowQuestForm(true); }} className="p-1.5 rounded hover:bg-slate-800 text-indigo-400">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteQuest(q.id)} className="p-1.5 rounded hover:bg-slate-800 text-rose-400">
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
            onClick={() => { setEditingCosmetic(null); setCName(""); setCType("badge"); setCCost(50); setCIcon("🏆"); setShowCosmeticForm(true); }}
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Nuovo Cosmetico
          </button>
        </div>

        {showCosmeticForm && (
          <form onSubmit={handleSaveCosmetic} className="glass-card p-4 space-y-3 border-indigo-500/40">
            <h4 className="text-xs font-bold text-indigo-300">{editingCosmetic ? "Modifica Cosmetico" : "Nuovo Cosmetico"}</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400">Nome</label>
                <input type="text" required value={cName} onChange={(e) => setCName(e.target.value)} className="input-field w-full text-xs" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400">Tipo</label>
                <select value={cType} onChange={(e) => setCType(e.target.value)} className="input-field w-full text-xs">
                  <option value="badge">Badge</option>
                  <option value="frame">Cornice (Frame)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400">Costo Punti</label>
                <input type="number" required min="0" value={cCost} onChange={(e) => setCCost(parseInt(e.target.value, 10) || 0)} className="input-field w-full text-xs" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400">Icona / Class CSS</label>
                <input type="text" required value={cIcon} onChange={(e) => setCIcon(e.target.value)} className="input-field w-full text-xs" placeholder="🏆 o border-amber-400" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowCosmeticForm(false)} className="btn-secondary py-1 px-3 text-xs">Annulla</button>
              <button type="submit" className="btn-primary py-1 px-3 text-xs">Salva</button>
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
                  <button onClick={() => { setEditingCosmetic(c); setCName(c.name); setCType(c.type); setCCost(c.cost_points); setCIcon(c.icon_value); setShowCosmeticForm(true); }} className="p-1.5 rounded hover:bg-slate-800 text-indigo-400">
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
   TAB 4: MORALS PREDEFINITE
   ============================================================================== */
function MoralsTab({ showToast }: { showToast: (msg: string, type?: "success" | "error") => void }) {
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
    if (!confirm("Eliminare questa morale predefinita?")) return;
    try {
      const res = await fetch(`/api/admin/morals?id=${id}`, { method: "DELETE" });
      if (res.ok) { showToast("Morale eliminata"); loadMorals(); }
    } catch { showToast("Errore di rete", "error"); }
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
   TAB 5: PRESET STORIES
   ============================================================================== */
function PresetStoriesTab({ showToast }: { showToast: (msg: string, type?: "success" | "error") => void }) {
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
    if (!confirm("Eliminare questa storia preset?")) return;
    try {
      const res = await fetch(`/api/admin/preset-stories?id=${id}`, { method: "DELETE" });
      if (res.ok) { showToast("Storia eliminata"); loadStories(); }
    } catch { showToast("Errore di rete", "error"); }
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
