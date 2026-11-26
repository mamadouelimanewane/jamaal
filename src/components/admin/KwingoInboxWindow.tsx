"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  Clock,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Smartphone,
  Sparkles,
  UserCheck,
  UserX,
  X,
} from "lucide-react";

type ConsultantOption = {
  id: string;
  name: string;
  city: string;
  email: string | null;
  whatsapp: string;
  assignedCount: number;
};

type ThreadItem = {
  phone: string;
  name: string;
  lastMessage: string;
  lastMessageDirection: string | null;
  lastMessageAt: string;
  lastInboundAt: string | null;
  windowOpen: boolean;
  unreadCount: number;
  botPausedUntil: string | null;
  assigned_to: string | null;
  consultantName: string | null;
  assignedAt: string | null;
  assignedSource: string | null;
  customAttributes: Record<string, unknown>;
};

type MessageItem = {
  id: string;
  direction: string;
  kind: string;
  body: string;
  status: string;
  error: string | null;
  createdAt: string;
};

type OrderItem = {
  id: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  total: number;
  channel: string;
};

type TemplateItem = {
  id: string;
  title: string;
  category: string;
  text: string;
  isMetaApproved?: boolean;
  templateName?: string;
  language?: string;
};

type KwingoConnectionState = {
  connected: boolean;
  email: string | null;
  companyName: string | null;
  embedUrl: string;
};

type InboxPayload = {
  viewer: {
    mode: "SUPERVISOR" | "CONSULTANT";
    consultantId: string | null;
    consultantName: string | null;
    canWrite: boolean;
  };
  config: {
    whatsappActive: boolean;
    provider: string;
    templateName: string;
    bridgeRemoteEnabled: boolean;
    embedUrl: string;
    kwingoConnection?: KwingoConnectionState;
  };
  counts: {
    all: number;
    unassigned: number;
  };
  consultants: ConsultantOption[];
  templates: TemplateItem[];
  threads: ThreadItem[];
  activePhone: string;
  activeThread: {
    phone: string;
    name: string;
    assigned_to: string | null;
    consultantName: string | null;
    assignedSource: string | null;
    customAttributes: Record<string, unknown>;
    windowOpen: boolean;
    botPausedUntil: string | null;
  } | null;
  messages: MessageItem[];
  orders: OrderItem[];
  customer: {
    id: string;
    name: string;
    whatsappOptOut: boolean;
    consultantId: string | null;
  } | null;
};

const WHO_LABELS: Record<string, string> = {
  bot: "Assistant JAMAAL",
  conseiller: "Réponse Cloud API",
  suivi: "Suivi commande",
  relance: "Relance",
  avis: "Avis",
  campagne: "Campagne",
  kit: "Kit du matin",
  livreur: "Livreur",
  team: "Équipe",
  reseller: "Revendeur",
  client: "Notification",
  test: "Test",
  resume: "Résumé",
};

const SOURCE_BADGES: Record<string, { label: string; short: string }> = {
  CAMPAGNE: { label: "Redirigé automatiquement (retour de campagne)", short: "Auto · Campagne" },
  ROUTAGE_CLIENT: { label: "Redirigé automatiquement (client rattaché)", short: "Auto · Client" },
  LIEN_BOUTIQUE: { label: "Redirigé automatiquement (lien boutique)", short: "Auto · Boutique" },
  MANUEL: { label: "Redirigé manuellement par l'équipe", short: "Assigné manuellement" },
  UNASSIGNED: { label: "Non assigné (unassigned)", short: "Non assigné" },
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  NON_PAYEE: "Non payée",
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

function formatPhoneDisplay(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("221") && d.length === 12) {
    return `+221 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
  }
  return `+${d}`;
}

export function KwingoInboxWindow({
  initialPhone = "",
  initialSearch = "",
  initialManager = "all",
}: {
  initialPhone?: string;
  initialSearch?: string;
  initialManager?: string;
}) {
  const [data, setData] = useState<InboxPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState(initialPhone);
  const [managerFilter, setManagerFilter] = useState(initialManager);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedMetaTemplate, setSelectedMetaTemplate] = useState<{
    templateName: string;
    language: string;
    title: string;
  } | null>(null);
  const [selectedInternalQuickText, setSelectedInternalQuickText] = useState<{
    title: string;
  } | null>(null);
  const [showOrdersDrawer, setShowOrdersDrawer] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(Boolean(initialPhone));

  // Fenêtre de connexion vers KwingoChat / Jamaal Luxury (Admin uniquement)
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [kwingoEmail, setKwingoEmail] = useState("");
  const [kwingoPassword, setKwingoPassword] = useState("");
  const [connectingKwingo, setConnectingKwingo] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [syncingKwingo, setSyncingKwingo] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastScrolledPhoneRef = useRef<string>("");
  const lastMessageIdRef = useRef<string>("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadInbox = useCallback(
    async (silent = false, forceSync = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (managerFilter) params.set("managerId", managerFilter);
        if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
        if (selectedPhone) params.set("phone", selectedPhone);
        if (forceSync) params.set("sync", "1");

        const res = await fetch(`/api/whatsapp/inbox?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as InboxPayload;
        // Tri chronologique WhatsApp : les messages les plus anciens en haut, le dernier message en bas
        if (Array.isArray(json.messages)) {
          json.messages.sort((a, b) => {
            const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return diff !== 0 ? diff : a.id.localeCompare(b.id);
          });
        }
        setData(json);
        if (!selectedPhone && json.activePhone) {
          setSelectedPhone(json.activePhone);
        }
        if (json.config.kwingoConnection?.email) {
          setKwingoEmail((prev) => prev || json.config.kwingoConnection!.email || "");
        }
      } catch {
        // Ignore transient network errors during background polling
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [managerFilter, debouncedSearch, selectedPhone],
  );

  useEffect(() => {
    void loadInbox(false);
  }, [loadInbox]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadInbox(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [loadInbox]);

  // Défilement interne UNIQUEMENT dans le conteneur des messages (comme dans WhatsApp) :
  // - à l'ouverture / changement de conversation : positionnement direct sur le dernier message en bas
  // - lorsqu'un nouveau message arrive en bas ET que l'utilisateur était déjà proche du bas
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const currentPhone = data?.activePhone || selectedPhone || "";
    const msgs = data?.messages ?? [];
    const latestId = msgs.length > 0 ? msgs[msgs.length - 1].id : "";

    const phoneChanged = currentPhone !== lastScrolledPhoneRef.current;
    const hasNewMessage = latestId !== "" && latestId !== lastMessageIdRef.current;

    const scrollToBottom = () => {
      requestAnimationFrame(() => {
        const node = messagesContainerRef.current;
        if (node) node.scrollTop = node.scrollHeight;
      });
    };

    if (phoneChanged) {
      scrollToBottom();
      lastScrolledPhoneRef.current = currentPhone;
      lastMessageIdRef.current = latestId;
    } else if (hasNewMessage) {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 180) {
        scrollToBottom();
      }
      lastMessageIdRef.current = latestId;
    }
  }, [data?.activePhone, data?.messages, selectedPhone]);

  async function handleConnectKwingo(e: React.FormEvent) {
    e.preventDefault();
    setConnectingKwingo(true);
    setConnectError(null);
    try {
      const res = await fetch("/api/whatsapp/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect_kwingo",
          email: kwingoEmail,
          password: kwingoPassword,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        setConnectError(json.error || "Impossible de se connecter à KwingoChat.");
      } else {
        setShowConnectModal(false);
        setKwingoPassword("");
        setFeedback({ ok: true, text: json.message || "Connecté à KwingoChat (Jamaal Luxury) !" });
        await loadInbox(false, true);
      }
    } catch {
      setConnectError("Erreur réseau lors de la connexion à KwingoChat.");
    } finally {
      setConnectingKwingo(false);
    }
  }

  async function handleDisconnectKwingo() {
    setConnectingKwingo(true);
    try {
      await fetch("/api/whatsapp/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect_kwingo" }),
      });
      setShowConnectModal(false);
      setFeedback({ ok: true, text: "Compte KwingoChat déconnecté." });
      await loadInbox(false);
    } finally {
      setConnectingKwingo(false);
    }
  }

  async function handleSyncFromKwingo() {
    setSyncingKwingo(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/whatsapp/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_kwingo",
          phone: data?.activePhone || selectedPhone || undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      setFeedback({
        ok: Boolean(json.ok),
        text: json.message || "Synchronisation terminée.",
      });
      await loadInbox(true);
    } finally {
      setSyncingKwingo(false);
    }
  }

  async function handleSendCloudApi(useTemplate = false) {
    const targetPhone = data?.activePhone || selectedPhone;
    if (!targetPhone || !messageText.trim() || sending) return;

    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/whatsapp/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          phone: targetPhone,
          text: messageText.trim(),
          useTemplate: useTemplate || Boolean(selectedMetaTemplate),
          templateName: selectedMetaTemplate?.templateName,
          templateLanguage: selectedMetaTemplate?.language,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        setFeedback({ ok: false, text: json.error || "Échec de l'envoi." });
      } else {
        setMessageText("");
        setSelectedMetaTemplate(null);
        setSelectedInternalQuickText(null);
        setShowTemplates(false);
        setFeedback({ ok: true, text: json.message || "Réponse envoyée via l'API Cloud." });
        await loadInbox(true);
      }
    } catch {
      setFeedback({ ok: false, text: "Erreur réseau lors de l'envoi." });
    } finally {
      setSending(false);
    }
  }

  async function handleAssign(consultantId: string | null) {
    const targetPhone = data?.activePhone || selectedPhone;
    if (!targetPhone || assigning) return;
    setAssigning(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/whatsapp/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          phone: targetPhone,
          consultantId,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; consultantName?: string | null; error?: string };
      if (res.ok && json.ok) {
        setFeedback({
          ok: true,
          text: json.consultantName
            ? `Conversation assignée à ${json.consultantName}.`
            : "Conversation placée dans Non assignés (unassigned).",
        });
        await loadInbox(true);
      } else {
        setFeedback({ ok: false, text: json.error || "Impossible de modifier l'assignation." });
      }
    } finally {
      setAssigning(false);
    }
  }

  async function handleDynamicReroute() {
    const targetPhone = data?.activePhone || selectedPhone;
    if (!targetPhone || assigning) return;
    setAssigning(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/whatsapp/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reroute",
          phone: targetPhone,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        consultantName?: string | null;
        routing_source?: string;
      };
      if (res.ok && json.ok) {
        setFeedback({
          ok: true,
          text: json.consultantName
            ? `Routage automatique : rattaché à ${json.consultantName}.`
            : "Aucun consultant trouvé pour ce client : maintenu dans Non assignés (unassigned).",
        });
        await loadInbox(true);
      }
    } finally {
      setAssigning(false);
    }
  }

  async function handleToggleBot(hours: number) {
    const targetPhone = data?.activePhone || selectedPhone;
    if (!targetPhone) return;
    await fetch("/api/whatsapp/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "bot_pause",
        phone: targetPhone,
        hours,
      }),
    });
    await loadInbox(true);
  }

  const isSupervisor = data?.viewer.mode === "SUPERVISOR";
  const activeThread = data?.activeThread ?? null;
  const kwingoConn = data?.config.kwingoConnection;
  const isKwingoConnected = Boolean(kwingoConn?.connected);

  // Construit le lien pour répondre depuis le WhatsApp personnel (mobile ou PC) du parrain/consultant
  function buildPersonalWhatsAppUrl(thread: NonNullable<InboxPayload["activeThread"]>): string {
    const cleanPhone = thread.phone.replace(/\D/g, "");
    const typed = messageText.trim();
    if (typed) {
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(typed)}`;
    }
    const clientFirst = thread.name && !thread.name.startsWith("+") ? thread.name.split(/\s+/)[0] : "";
    const myName = data?.viewer.consultantName || "votre conseiller";
    const defaultGreeting = clientFirst
      ? `Bonjour ${clientFirst}, c'est ${myName} de JAMAAL Luxury, suite à votre message : `
      : `Bonjour, c'est ${myName} de JAMAAL Luxury, suite à votre message : `;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultGreeting)}`;
  }

  const activeSourceKey =
    activeThread?.assignedSource ||
    (typeof activeThread?.customAttributes?.routing_source === "string"
      ? String(activeThread.customAttributes.routing_source)
      : "UNASSIGNED");
  const activeSourceInfo = SOURCE_BADGES[activeSourceKey] ?? SOURCE_BADGES.UNASSIGNED;

  return (
    <div className="space-y-4">
      {/* Barre supérieure épurée */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-[#25D366]" />
            Numéro Business JAMAAL Luxury · +221 71 180 09 09 (API Cloud)
          </span>
          {!isSupervisor && data?.viewer.consultantName && (
            <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-navy">
              Conversations redirigées vers {data.viewer.consultantName}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSupervisor && (
            <button
              type="button"
              onClick={() => {
                setConnectError(null);
                setShowConnectModal(true);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                isKwingoConnected
                  ? "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  : "bg-navy text-white hover:bg-navy-light"
              }`}
            >
              <KeyRound size={13} />
              {isKwingoConnected ? "Compte KwingoChat connecté" : "Connecter KwingoChat"}
            </button>
          )}

          {isKwingoConnected && (
            <button
              type="button"
              disabled={syncingKwingo}
              onClick={() => void handleSyncFromKwingo()}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-navy hover:bg-cream disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncingKwingo ? "animate-spin" : ""} /> Synchroniser
            </button>
          )}

          <button
            type="button"
            onClick={() => void loadInbox(false)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-navy hover:bg-cream"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualiser
          </button>
        </div>
      </div>

      {/* Fenêtre modale de connexion KwingoChat (Admin uniquement) */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-navy shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy">
                  <Sparkles size={18} className="text-[#1f9d55]" />
                  Connexion KwingoChat · Jamaal Luxury
                </h2>
                <p className="mt-1 text-xs text-navy/70">
                  Entrez votre email et mot de passe KwingoChat pour synchroniser les messages envoyés au numéro Business <strong>+221 71 180 09 09</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="rounded-lg p-1.5 text-navy/50 hover:bg-cream hover:text-navy"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConnectKwingo} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-navy">Email KwingoChat</label>
                <input
                  type="email"
                  required
                  value={kwingoEmail}
                  onChange={(e) => setKwingoEmail(e.target.value)}
                  placeholder="ex: contact@jamaal.sn"
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-ia"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-navy">Mot de passe KwingoChat</label>
                <input
                  type="password"
                  required
                  value={kwingoPassword}
                  onChange={(e) => setKwingoPassword(e.target.value)}
                  placeholder="Votre mot de passe KwingoChat"
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-ia"
                />
              </div>

              {connectError && (
                <div className="rounded-xl border border-rose/30 bg-rose/10 p-3 text-xs text-rose-dark">
                  {connectError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                {isKwingoConnected ? (
                  <button
                    type="button"
                    disabled={connectingKwingo}
                    onClick={() => void handleDisconnectKwingo()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose/40 bg-rose/10 px-3.5 py-2 text-xs font-semibold text-rose-dark hover:bg-rose/20"
                  >
                    <LogOut size={13} /> Déconnecter
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConnectModal(false)}
                    className="rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={connectingKwingo}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1ebe5b] disabled:opacity-50"
                  >
                    {connectingKwingo ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                    <span>Se connecter</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fenêtre principale épurée en 2 colonnes claires et lisibles */}
      <div className="grid min-h-[74vh] overflow-hidden rounded-2xl border border-line bg-white shadow-sm lg:grid-cols-[22rem_1fr]">
        {/* COLONNE GAUCHE : Liste des conversations */}
        <aside
          className={`flex flex-col border-b border-line bg-white lg:border-b-0 lg:border-r ${
            showMobileChat ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="space-y-3 border-b border-line p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif-display text-base font-semibold text-navy">
                {isSupervisor ? "Toutes les conversations" : "Mes conversations clients"}
              </h2>
              <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-bold text-navy">
                {data?.threads.length ?? 0}
              </span>
            </div>

            {/* Barre de recherche */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/45" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un client ou un numéro…"
                className="w-full rounded-xl border border-line bg-cream/40 py-2 pl-9 pr-3 text-sm text-navy placeholder-navy/45 outline-none focus:border-ia focus:bg-white"
              />
            </div>

            {/* Filtres Superviseur (Admin uniquement) */}
            {isSupervisor && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setManagerFilter("all")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      managerFilter === "all"
                        ? "bg-navy text-white"
                        : "bg-cream text-navy/75 hover:text-navy"
                    }`}
                  >
                    Tous ({data?.counts.all ?? 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setManagerFilter("unassigned")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      managerFilter === "unassigned"
                        ? "bg-amber-600 text-white"
                        : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                    }`}
                  >
                    Non assignés ({data?.counts.unassigned ?? 0})
                  </button>
                </div>

                <select
                  aria-label="Filtrer par parrain ou consultant"
                  value={managerFilter}
                  onChange={(e) => setManagerFilter(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-navy outline-none focus:border-ia"
                >
                  <option value="all">Tous les parrains & consultants ({data?.counts.all ?? 0})</option>
                  <option value="unassigned">Non assignés / Unassigned ({data?.counts.unassigned ?? 0})</option>
                  {(data?.consultants ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city}) — {c.assignedCount} conv.
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Liste des fils de discussion */}
          <div className="max-h-[64vh] flex-1 divide-y divide-line/60 overflow-y-auto">
            {loading && !data ? (
              <div className="flex items-center justify-center gap-2 p-10 text-sm text-navy/60">
                <Loader2 size={16} className="animate-spin" /> Chargement des conversations…
              </div>
            ) : (data?.threads.length ?? 0) === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-semibold text-navy">Aucune conversation pour le moment</p>
                <p className="mt-1 text-xs text-navy/60">
                  {isSupervisor
                    ? "Aucun échange ne correspond à ce filtre."
                    : "Les messages envoyés par vos clients au numéro Business JAMAAL Luxury (+221 71 180 09 09) apparaîtront automatiquement ici."}
                </p>
              </div>
            ) : (
              (data?.threads ?? []).map((t) => {
                const selected = t.phone === (data?.activePhone || selectedPhone);
                const srcInfo =
                  SOURCE_BADGES[t.assignedSource ?? ""] ??
                  (t.assigned_to ? SOURCE_BADGES.ROUTAGE_CLIENT : SOURCE_BADGES.UNASSIGNED);

                return (
                  <button
                    key={t.phone}
                    type="button"
                    onClick={() => {
                      setSelectedPhone(t.phone);
                      setShowMobileChat(true);
                      setFeedback(null);
                    }}
                    className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition ${
                      selected ? "bg-ia-light/40 border-l-4 border-navy" : "hover:bg-cream/60"
                    }`}
                  >
                    {/* Avatar + pastille 24h */}
                    <div className="relative shrink-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                        {t.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "CL"}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                          t.windowOpen ? "bg-[#25D366]" : "bg-amber-400"
                        }`}
                        title={
                          t.windowOpen
                            ? "Fenêtre 24h ouverte : réponse via API Cloud disponible"
                            : "Fenêtre 24h expirée : répondre via votre WhatsApp personnel"
                        }
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-navy">
                          {t.name.startsWith("+") ? formatPhoneDisplay(t.phone) : t.name}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {t.unreadCount > 0 && (
                            <span className="rounded-full bg-[#25D366] px-2 py-0.5 text-[11px] font-bold text-white">
                              {t.unreadCount}
                            </span>
                          )}
                          <span className="shrink-0 whitespace-nowrap text-[11px] text-navy/55">
                            {new Date(t.lastMessageAt).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      <p className="mt-0.5 truncate text-xs text-navy/70">
                        {t.lastMessageDirection === "OUT" ? "Vous : " : ""}
                        {t.lastMessage || "Nouvelle conversation"}
                      </p>

                      {/* Badges clairs et épurés */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {isSupervisor ? (
                          t.assigned_to ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                              <UserCheck size={11} />
                              <span className="truncate max-w-[9rem]">{t.consultantName || "Assigné"}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                              <UserX size={11} />
                              <span>Non assigné</span>
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[11px] font-medium text-navy/75">
                            {srcInfo.short}
                          </span>
                        )}

                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            t.windowOpen
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {t.windowOpen ? "24h ouverte" : "Hors 24h"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* COLONNE DROITE : Fenêtre de conversation épurée + Double choix de réponse */}
        <section
          className={`flex min-w-0 flex-col bg-white ${
            showMobileChat ? "flex" : "hidden lg:flex"
          }`}
        >
          {activeThread ? (
            <>
              {/* En-tête de la conversation */}
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowMobileChat(false)}
                    className="rounded-lg p-1.5 text-navy/60 hover:bg-cream hover:text-navy lg:hidden"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-navy">
                        {activeThread.name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          activeThread.windowOpen
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        <Clock size={12} />
                        {activeThread.windowOpen
                          ? "Fenêtre 24h ouverte (API Cloud active)"
                          : "Fenêtre 24h fermée"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-navy/65">
                      {formatPhoneDisplay(activeThread.phone)} · {activeSourceInfo.label}
                      {data?.customer?.whatsappOptOut ? " · A répondu STOP" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Sélecteur de redirection (Superviseur / Admin uniquement) */}
                  {isSupervisor && (
                    <>
                      <select
                        aria-label="Rediriger vers un parrain ou consultant"
                        disabled={assigning}
                        value={activeThread.assigned_to ?? ""}
                        onChange={(e) => void handleAssign(e.target.value || null)}
                        className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy outline-none focus:border-ia"
                      >
                        <option value="">— Non assigné (unassigned) —</option>
                        {(data?.consultants ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            Rediriger vers : {c.name} ({c.city})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={assigning}
                        onClick={() => void handleDynamicReroute()}
                        className="rounded-full border border-line bg-cream px-3 py-1.5 text-xs font-semibold text-navy hover:bg-line/40 disabled:opacity-50"
                      >
                        Routage auto
                      </button>
                    </>
                  )}

                  {/* Bouton Commandes du client (toujours visible et repliable) */}
                  <button
                    type="button"
                    onClick={() => setShowOrdersDrawer((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      showOrdersDrawer
                        ? "border-navy bg-navy text-white"
                        : "border-line bg-white text-navy hover:bg-cream"
                    }`}
                  >
                    <ShoppingBag size={13} />
                    Commandes client ({data?.orders.length ?? 0})
                  </button>

                  {/* Pause / Relance Assistant IA */}
                  {activeThread.botPausedUntil ? (
                    <button
                      type="button"
                      onClick={() => void handleToggleBot(0)}
                      className="inline-flex items-center gap-1 rounded-full bg-ia px-3 py-1.5 text-xs font-semibold text-white hover:bg-ia-dark"
                    >
                      <Bot size={13} /> Relancer l&apos;assistant
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleToggleBot(24)}
                      className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream"
                    >
                      <Bot size={13} /> Pause assistant 24h
                    </button>
                  )}
                </div>
              </header>

              {/* Bandeau repliable des commandes du client */}
              {showOrdersDrawer && (
                <div className="border-b border-line bg-cream/60 px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-navy/70">
                      Commandes du client ({data?.orders.length ?? 0})
                    </p>
                    <div className="flex items-center gap-3">
                      {!isSupervisor && (
                        <Link
                          href="/admin/acheter"
                          className="text-xs font-semibold text-[#1f9d55] underline hover:opacity-80"
                        >
                          + Créer une commande pour ce client
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowOrdersDrawer(false)}
                        className="text-xs font-semibold text-navy/60 hover:text-navy"
                      >
                        Replier ▴
                      </button>
                    </div>
                  </div>
                  {(data?.orders.length ?? 0) > 0 ? (
                    <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1">
                      {data!.orders.map((o) => (
                        <Link
                          key={o.id}
                          href={isSupervisor ? `/admin/commandes/${o.id}` : `/admin/mes-commandes/${o.id}`}
                          className="min-w-[14rem] rounded-xl border border-line bg-white p-3 text-xs shadow-2xs transition hover:border-navy"
                        >
                          <div className="flex items-center justify-between font-semibold text-navy">
                            <span>Commande #{o.id.slice(-8).toUpperCase()}</span>
                            <span>{o.total.toLocaleString("fr-FR")} FCFA</span>
                          </div>
                          <p className="mt-1 text-[11px] text-navy/65">
                            {new Date(o.createdAt).toLocaleDateString("fr-FR")} ·{" "}
                            {ORDER_STATUS_LABELS[o.status] ?? o.status} (
                            {o.paymentStatus === "PAYE" ? "payée" : "non payée"})
                          </p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-navy/65">
                      Aucune commande enregistrée pour ce numéro ({formatPhoneDisplay(activeThread.phone)}).
                    </p>
                  )}
                </div>
              )}

              {/* Zone des messages — style WhatsApp clair et très lisible */}
              <div
                ref={messagesContainerRef}
                className="flex h-[52vh] flex-1 flex-col gap-3 overflow-y-auto bg-[#efeae2] p-5"
              >
                {(data?.messages ?? []).map((m) => {
                  const isIn = m.direction === "IN";
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs ${
                        isIn
                          ? "self-start rounded-tl-xs bg-white text-navy"
                          : "self-end rounded-tr-xs bg-[#d9fdd3] text-navy"
                      }`}
                    >
                      {!isIn && (
                        <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-[#1f9d55]">
                          {WHO_LABELS[m.kind] ?? m.kind}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-navy/50">
                        <span>
                          {new Date(m.createdAt).toLocaleString("fr-FR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                        {!isIn && (
                          <span className="inline-flex items-center gap-0.5 font-semibold text-[#1f9d55]">
                            <CheckCheck size={12} /> {m.status}
                          </span>
                        )}
                      </div>
                      {m.error && <p className="mt-1 text-xs text-rose-dark">{m.error}</p>}
                    </div>
                  );
                })}
              </div>

              {/* Fenêtre « Modèles de réponses rapides » : Modèles approuvés par Meta + Textes rapides */}
              {showTemplates && (
                <div className="border-t border-line bg-cream/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-navy">
                        Modèles de réponses rapides
                      </p>
                      <p className="text-[11px] text-navy/65">
                        {activeThread.windowOpen
                          ? "Fenêtre 24 h ouverte : vous pouvez utiliser les modèles Meta ou les textes rapides internes JAMAAL via l'API Cloud."
                          : "Hors fenêtre 24 h : seuls les modèles approuvés par Meta sont utilisables pour l'envoi par API Cloud. Les textes rapides internes JAMAAL sont réservés au WhatsApp personnel."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTemplates(false)}
                      className="text-xs font-semibold text-navy/60 hover:text-navy"
                    >
                      Fermer
                    </button>
                  </div>

                  <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
                    {/* 1. Modèles approuvés par Meta */}
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1f9d55]">
                        1. Modèles approuvés par Meta (Utilisables par API Cloud)
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(data?.templates ?? [])
                          .filter((tpl) => tpl.isMetaApproved)
                          .map((tpl) => {
                            const isSelected = selectedMetaTemplate?.templateName === tpl.templateName && selectedMetaTemplate?.title === tpl.title;
                            return (
                              <button
                                key={tpl.id}
                                type="button"
                                onClick={() => {
                                  const firstName = activeThread.name.startsWith("+")
                                    ? "Client"
                                    : activeThread.name.split(/\s+/)[0] || "Client";
                                  setMessageText(
                                    tpl.text
                                      .replace(/\{prenom\}/gi, firstName)
                                      .replace(/\{\{1\}\}/g, firstName),
                                  );
                                  setSelectedMetaTemplate(
                                    tpl.templateName
                                      ? {
                                          templateName: tpl.templateName,
                                          language: tpl.language || "fr",
                                          title: tpl.title,
                                        }
                                      : null,
                                  );
                                  setSelectedInternalQuickText(null);
                                  setShowTemplates(false);
                                }}
                                className={`rounded-xl border p-2.5 text-left text-xs transition ${
                                  isSelected
                                    ? "border-[#25D366] bg-emerald-50/70"
                                    : "border-emerald-200 bg-white hover:border-[#25D366]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate font-semibold text-navy">{tpl.title}</p>
                                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#1f9d55] border border-emerald-200">
                                    ✓ Approuvé Meta · API Cloud
                                  </span>
                                </div>
                                <p className="mt-1 line-clamp-2 text-navy/70">{tpl.text}</p>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* 2. Textes rapides internes JAMAAL (utilisables en texte libre dans la fenêtre 24h, WhatsApp personnel hors 24h) */}
                    <div>
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <p
                          className={`text-[11px] font-bold uppercase tracking-wider ${
                            activeThread.windowOpen ? "text-navy" : "text-amber-800"
                          }`}
                        >
                          {activeThread.windowOpen
                            ? "2. Textes rapides internes JAMAAL (Utilisables par API Cloud · 24h ouverte)"
                            : "2. Textes rapides internes JAMAAL (Non utilisables par API Cloud hors 24h)"}
                        </p>
                        {activeThread.windowOpen ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-[#1f9d55]">
                            ✓ Utilisable par API Cloud (texte libre 24h)
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                            ⚠️ Non utilisables par API Cloud hors 24h · WhatsApp personnel uniquement
                          </span>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(data?.templates ?? [])
                          .filter((tpl) => !tpl.isMetaApproved)
                          .map((tpl) => {
                            const isSelectedInternal = selectedInternalQuickText?.title === tpl.title;
                            return (
                              <button
                                key={tpl.id}
                                type="button"
                                onClick={() => {
                                  setMessageText(
                                    tpl.text.replace(
                                      /\{prenom\}/gi,
                                      activeThread.name.startsWith("+") ? "" : activeThread.name.split(/\s+/)[0] || "",
                                    ),
                                  );
                                  setSelectedMetaTemplate(null);
                                  setSelectedInternalQuickText({ title: tpl.title });
                                  setShowTemplates(false);
                                }}
                                className={`rounded-xl border p-2.5 text-left text-xs transition ${
                                  isSelectedInternal
                                    ? activeThread.windowOpen
                                      ? "border-[#25D366] bg-emerald-50/70"
                                      : "border-amber-400 bg-amber-50/70"
                                    : activeThread.windowOpen
                                      ? "border-line bg-white hover:border-[#25D366]"
                                      : "border-line bg-white hover:border-amber-400"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate font-semibold text-navy">{tpl.title}</p>
                                  {activeThread.windowOpen ? (
                                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-[#1f9d55]">
                                      Texte libre · 24h
                                    </span>
                                  ) : (
                                    <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                      Non utilisable API Cloud
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 line-clamp-2 text-navy/65">{tpl.text}</p>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Zone de réponse avec les 2 options explicites :
                  1) Répondre dans la conversation via l'API Cloud (si dans la fenêtre de 24 h)
                  2) Répondre à partir de son WhatsApp personnel (installé sur mobile ou PC) */}
              <div className="border-t border-line bg-white p-4">
                {feedback && (
                  <p
                    className={`mb-3 rounded-xl px-3.5 py-2 text-xs font-medium ${
                      feedback.ok
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-rose/10 text-rose-dark border border-rose/20"
                    }`}
                  >
                    {feedback.text}
                  </p>
                )}

                {selectedMetaTemplate && (
                  <div className="mb-2.5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs text-emerald-900">
                    <span>
                      ✓ Modèle approuvé Meta sélectionné pour l&apos;API Cloud : <strong>{selectedMetaTemplate.title}</strong> (
                      <code>{selectedMetaTemplate.templateName}</code>)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedMetaTemplate(null)}
                      className="ml-2 font-semibold text-emerald-800 hover:underline"
                    >
                      Retirer ×
                    </button>
                  </div>
                )}

                {selectedInternalQuickText && !activeThread.windowOpen && (
                  <div className="mb-2.5 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <span>
                      ⚠️ Texte rapide interne JAMAAL sélectionné (<strong>{selectedInternalQuickText.title}</strong>) :{" "}
                      <strong>non utilisable par API Cloud hors fenêtre 24 h</strong>. Utilisez le bouton{" "}
                      <strong>« Répondre avec mon WhatsApp personnel (Mobile / PC) »</strong> ou choisissez un modèle approuvé Meta.
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedInternalQuickText(null)}
                      className="ml-2 shrink-0 font-semibold text-amber-800 hover:underline"
                    >
                      Retirer ×
                    </button>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTemplates((v) => !v)}
                    className="shrink-0 rounded-xl border border-line bg-cream/60 px-3 py-2.5 text-xs font-semibold text-navy hover:bg-cream"
                  >
                    Modèles de réponses rapides
                  </button>
                  <textarea
                    rows={2}
                    maxLength={1500}
                    value={messageText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMessageText(val);
                      if (!val.trim()) {
                        setSelectedInternalQuickText(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        (e.ctrlKey || e.metaKey) &&
                        activeThread.windowOpen
                      ) {
                        e.preventDefault();
                        void handleSendCloudApi(false);
                      }
                    }}
                    placeholder="Écrivez votre message au client (puis choisissez ci-dessous d'envoyer via l'API Cloud ou via votre WhatsApp personnel)…"
                    className="flex-1 resize-none rounded-xl border border-line bg-white px-3.5 py-2 text-sm text-navy placeholder-navy/45 outline-none focus:border-ia focus:ring-4 focus:ring-ia/10"
                  />
                </div>

                {/* Les boutons d'envoi :
                    - Dans les 24h : API Cloud + WhatsApp personnel
                    - Hors 24h : WhatsApp personnel uniquement pour un parrain/consultant (l'envoi par modèle Cloud est réservé aux administrateurs) */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 pt-1">
                  <p className="text-xs text-navy/60">
                    {selectedInternalQuickText && !activeThread.windowOpen
                      ? "Ce texte rapide interne JAMAAL n'est pas utilisable via l'API Cloud hors fenêtre 24 h : envoyez-le depuis votre WhatsApp personnel."
                      : activeThread.windowOpen
                        ? "Le client a écrit il y a moins de 24 h : répondez ici via l'API Cloud ou depuis votre WhatsApp personnel."
                        : isSupervisor
                          ? "Plus de 24 h écoulées : répondez via le modèle Cloud (admin) ou sur WhatsApp."
                          : "Plus de 24 h écoulées sur l'API Cloud : répondez à ce client depuis votre WhatsApp personnel (Mobile ou PC)."}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    {activeThread.windowOpen ? (
                      <button
                        type="button"
                        disabled={sending || !messageText.trim()}
                        onClick={() => void handleSendCloudApi(false)}
                        title="Envoyer la réponse dans la conversation via l'API Cloud JAMAAL Luxury"
                        className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#1ebe5b] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        <span>Répondre ici (API Cloud · 24h)</span>
                      </button>
                    ) : (
                      isSupervisor && (
                        <button
                          type="button"
                          disabled={sending || !messageText.trim() || Boolean(selectedInternalQuickText)}
                          onClick={() => void handleSendCloudApi(true)}
                          title={
                            selectedInternalQuickText
                              ? "Les textes rapides internes JAMAAL ne sont pas utilisables par l'API Cloud. Choisissez un modèle approuvé par Meta."
                              : "Envoie le message via le modèle approuvé Meta hors fenêtre 24h (réservé aux administrateurs)"
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-4 py-2.5 text-xs font-semibold text-navy hover:bg-line/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          <span>
                            {selectedInternalQuickText
                              ? "API Cloud indisponible (texte interne)"
                              : "Envoyer par modèle Cloud (Admin)"}
                          </span>
                        </button>
                      )
                    )}

                    {/* Répondre depuis son WhatsApp personnel (Mobile ou PC) */}
                    <a
                      href={buildPersonalWhatsAppUrl(activeThread)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-navy-light"
                    >
                      <Smartphone size={14} />
                      <span>Répondre avec mon WhatsApp personnel (Mobile / PC)</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="m-auto flex flex-col items-center gap-3 p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cream text-navy">
                <MessageSquare size={22} />
              </div>
              <p className="text-base font-semibold text-navy">Sélectionnez une conversation</p>
              <p className="max-w-sm text-xs leading-relaxed text-navy/65">
                Choisissez un client dans la liste à gauche pour lire son message envoyé au numéro Business de JAMAAL Luxury (+221 71 180 09 09) et lui répondre via l&apos;API Cloud ou depuis votre WhatsApp personnel.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
