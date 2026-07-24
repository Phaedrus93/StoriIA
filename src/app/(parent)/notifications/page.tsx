"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Trash2,
  CreditCard,
  Sparkles,
  Award,
  Info,
  ExternalLink,
} from "lucide-react";

interface NotificationItem {
  id: string;
  family_id: string;
  category: "billing" | "credits" | "activity" | "system";
  title: string;
  message: string;
  action_link?: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"unread" | "history">("unread");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const router = useRouter();

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // Ignora errore di rete
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAllRead() {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function handleClearRead() {
    // Il pulsante "Pulisci lette" adesso si limita a segnare tutto come letto,
    // in modo che finiscano nella tab Storico senza mai essere eliminate dal DB.
    await handleMarkAllRead();
  }

  async function handleNotificationClick(notif: NotificationItem) {
    if (!notif.is_read) {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notif.id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }
    if (notif.action_link) {
      router.push(notif.action_link);
    }
  }

  function getCategoryIcon(cat: NotificationItem["category"]) {
    switch (cat) {
      case "billing":
        return <CreditCard className="w-5 h-5 text-amber-400" />;
      case "credits":
        return <Sparkles className="w-5 h-5 text-indigo-400" />;
      case "activity":
        return <Award className="w-5 h-5 text-emerald-400" />;
      default:
        return <Info className="w-5 h-5 text-slate-400" />;
    }
  }

  const filteredByCategory =
    selectedCategory === "all"
      ? notifications
      : notifications.filter((n) => n.category === selectedCategory);

  const filtered =
    viewMode === "unread"
      ? filteredByCategory.filter((n) => !n.is_read)
      : filteredByCategory;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="text-xs font-semibold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 mb-3"
        >
          ← Torna indietro
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Bell className="w-6 h-6 text-indigo-400" />
              <span>Centro Notifiche</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Rimani aggiornato sul tuo abbonamento, saldo crediti e traguardi di lettura
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 border-indigo-500/30 text-indigo-300"
              >
                <CheckCheck className="w-4 h-4" />
                Segna tutte lette
              </button>
            )}
            <button
              type="button"
              onClick={handleClearRead}
              className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 border-slate-700 text-slate-400 hover:text-rose-400"
            >
              <Trash2 className="w-4 h-4" />
              Pulisci lette
            </button>
          </div>
        </div>
      </div>

      {/* Tabs / Filter */}
      <div className="flex flex-col gap-4">
        {/* Main Tabs (Non Lette / Storico) */}
        <div className="flex gap-2 p-1 bg-slate-900 rounded-2xl w-max border border-slate-800">
          <button
            onClick={() => setViewMode("unread")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === "unread"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Non Lette
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === "history"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Storico
          </button>
        </div>

        {/* Categories */}
        <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: "Tutte" },
          { key: "billing", label: "Abbonamenti & Scadenze" },
          { key: "credits", label: "Crediti AI" },
          { key: "activity", label: "Attività Bambini" },
          { key: "system", label: "Sistema" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSelectedCategory(tab.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedCategory === tab.key
                ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
        </div>
      </div>

      {/* List */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">
            Caricamento notifiche...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400 space-y-2">
            <p>Nessuna notifica in questa categoria.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filtered.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-5 cursor-pointer transition-all flex items-start gap-4 ${
                  notif.is_read
                    ? "bg-transparent hover:bg-slate-900/40"
                    : "bg-indigo-500/10 hover:bg-indigo-500/15"
                }`}
              >
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                  {getCategoryIcon(notif.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`text-sm font-bold truncate ${
                        notif.is_read ? "text-slate-300" : "text-white"
                      }`}
                    >
                      {notif.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-500">
                        {new Date(notif.created_at).toLocaleString("it-IT", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {!notif.is_read && (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    {notif.message}
                  </p>
                  {notif.action_link && (
                    <span className="inline-flex items-center gap-1 text-xs text-indigo-400 font-semibold mt-2 hover:underline">
                      Apri su StoriIA <ExternalLink className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
