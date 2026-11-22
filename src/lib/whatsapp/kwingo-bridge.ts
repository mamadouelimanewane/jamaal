/**
 * Passerelle Option A (Automatique via API) entre JAMAAL et KwingoChat :
 * 1. Connexion directe au compte KwingoChat / Jamaal Luxury depuis l'interface JAMAAL
 *    (stockée en base dans Setting "kwingochat_connection" avec rafraîchissement automatique du token).
 * 2. Assignation automatique des retours par consultant via les attributs de contact (customAttributes)
 *    lors de l'envoi d'une campagne.
 * 3. Routage dynamique vers le bon consultant lorsqu'un client envoie un message spontané
 *    (commande précédente, fiche client, panier abandonné, abonnement, parrainage ou lien /c/<slug>).
 * 4. Si le client n'a pas de consultant rattaché, il reste dans « unassigned » (consultantId = null,
 *    customAttributes.assigned_to = null).
 * 5. Synchronisation bidirectionnelle temps réel des conversations, messages et attributs avec KwingoChat.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canonicalizePhone } from "@/lib/phone";
import { phoneTail } from "@/lib/phone-match";

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET || "jamaal-default-secret-key-fallback";
  return createHash("sha256").update(secret).digest();
}

/** Chiffre en AES-256-GCM les identifiants de session KwingoChat avant stockage en base. */
function encryptPayload(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Déchiffre une valeur chiffrée par `encryptPayload` (rétro-compatible avec l'ancien JSON en clair). */
function decryptPayload(raw: string): string {
  if (!raw.startsWith("enc:v1:")) return raw;
  const [, , ivHex, tagHex, dataHex] = raw.split(":");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

export type RoutingSource = "CAMPAGNE" | "ROUTAGE_CLIENT" | "LIEN_BOUTIQUE" | "MANUEL" | "UNASSIGNED";

export interface ResolvedConsultant {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string;
  slug: string | null;
  city: string;
  source: Exclude<RoutingSource, "UNASSIGNED">;
}

export interface KwingoContactAttributes {
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_by?: string | null;
  consultant_id: string | null;
  consultant_name: string | null;
  consultant_email: string | null;
  consultant_phone: string | null;
  consultant_slug: string | null;
  routing_source: RoutingSource;
  campaign_id?: string | null;
  campaign_title?: string | null;
  [key: string]: unknown;
}

export interface KwingoStoredConnection {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  email: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  companyId?: string | null;
  companyName?: string | null;
  embedUrl?: string | null;
  connectedAt: string;
}

const SETTING_KEY = "kwingochat_connection";

export function kwingoBridgeConfig() {
  const apiUrl = (process.env.KWINGOCHAT_API_URL ?? "").trim().replace(/\/+$/, "");
  const apiKey = (process.env.KWINGOCHAT_API_KEY ?? process.env.KWINGOCHAT_TOKEN ?? process.env.WHATSAPP_APP_SECRET ?? "").trim();
  const companyId = (process.env.KWINGOCHAT_COMPANY_ID ?? "").trim();
  const embedUrl = (process.env.NEXT_PUBLIC_KWINGOCHAT_URL ?? process.env.KWINGOCHAT_DASHBOARD_URL ?? "").trim().replace(/\/+$/, "");
  const supabaseUrl = (process.env.KWINGOCHAT_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const supabaseAnonKey = (process.env.KWINGOCHAT_SUPABASE_ANON_KEY ?? "").trim();
  return {
    apiUrl,
    apiKey,
    companyId,
    embedUrl,
    supabaseUrl,
    supabaseAnonKey,
    remoteEnabled: Boolean(apiUrl && apiKey),
  };
}

/**
 * Lit la connexion KwingoChat enregistrée depuis la fenêtre de connexion JAMAAL (table Setting),
 * et rafraîchit automatiquement le token Supabase s'il arrive à expiration.
 */
export async function getKwingoConnection(): Promise<{
  connected: boolean;
  apiUrl: string;
  supabaseUrl: string;
  email: string | null;
  companyId: string | null;
  companyName: string | null;
  embedUrl: string;
  accessToken: string | null;
}> {
  const envCfg = kwingoBridgeConfig();
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } }).catch(() => null);

  if (row?.value) {
    try {
      const parsed = JSON.parse(decryptPayload(row.value)) as KwingoStoredConnection;
      let token = parsed.accessToken;
      const nowSec = Math.floor(Date.now() / 1000);

      // Rafraîchissement automatique du token s'il expire dans moins de 2 minutes :
      // 1. Passe d'abord par le backend KwingoChat (/auth/refresh) pour ne pas dépendre des variables Supabase côté JAMAAL
      // 2. Repli sur Supabase direct uniquement si /auth/refresh n'est pas encore déployé sur KwingoChat
      if (parsed.refreshToken && parsed.expiresAt && parsed.expiresAt - nowSec < 120) {
        const apiBase = (parsed.apiUrl || envCfg.apiUrl).replace(/\/+$/, "");
        let refreshed: {
          access_token?: string;
          refresh_token?: string;
          expires_at?: number;
          expires_in?: number;
          data?: { access_token?: string; refresh_token?: string; expires_at?: number; expires_in?: number };
        } | null = null;

        const kwingoRefreshRes = await fetch(`${apiBase}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: parsed.refreshToken }),
          signal: AbortSignal.timeout(8_000),
        }).catch(() => null);

        if (kwingoRefreshRes?.ok) {
          refreshed = await kwingoRefreshRes.json().catch(() => null);
          if (refreshed?.data) refreshed = refreshed.data;
        } else if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
          const sbRefreshRes = await fetch(`${parsed.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: parsed.supabaseAnonKey,
            },
            body: JSON.stringify({ refresh_token: parsed.refreshToken }),
            signal: AbortSignal.timeout(8_000),
          }).catch(() => null);
          if (sbRefreshRes?.ok) {
            refreshed = await sbRefreshRes.json().catch(() => null);
          }
        }

        if (refreshed?.access_token) {
          token = refreshed.access_token;
          const updated: KwingoStoredConnection = {
            ...parsed,
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token ?? parsed.refreshToken,
            expiresAt: refreshed.expires_at ?? (refreshed.expires_in ? nowSec + refreshed.expires_in : parsed.expiresAt),
          };
          const encryptedUpdated = encryptPayload(JSON.stringify(updated));
          await prisma.setting
            .upsert({
              where: { key: SETTING_KEY },
              create: { key: SETTING_KEY, value: encryptedUpdated },
              update: { value: encryptedUpdated },
            })
            .catch(() => {});
        }
      }

      if (token) {
        // Si l'URL enregistrée pointait vers l'instance Railway non configurée, bascule sur KWINGOCHAT_API_URL (.env)
        const resolvedApiUrl =
          parsed.apiUrl && !parsed.apiUrl.includes("1952bd87.up.railway.app")
            ? parsed.apiUrl
            : envCfg.apiUrl || "https://kwingochat-backend.onrender.com/api/v1";
        return {
          connected: true,
          apiUrl: resolvedApiUrl.replace(/\/+$/, ""),
          supabaseUrl: (parsed.supabaseUrl || envCfg.supabaseUrl).replace(/\/+$/, ""),
          email: parsed.email || null,
          companyId: parsed.companyId || envCfg.companyId || "c7c500e4-0a75-40ca-afd6-74acf07da6f9",
          companyName: parsed.companyName || "Jamaal Luxury",
          embedUrl: (parsed.embedUrl || envCfg.embedUrl || "").replace(/\/+$/, ""),
          accessToken: token,
        };
      }
    } catch {
      // ignore malformed setting
    }
  }

  return {
    connected: Boolean(process.env.KWINGOCHAT_API_KEY || process.env.KWINGOCHAT_TOKEN),
    apiUrl: envCfg.apiUrl,
    supabaseUrl: envCfg.supabaseUrl,
    email: null,
    companyId: envCfg.companyId || null,
    companyName: process.env.KWINGOCHAT_API_KEY ? "Jamaal Luxury (.env)" : null,
    embedUrl: envCfg.embedUrl,
    accessToken: (process.env.KWINGOCHAT_API_KEY ?? process.env.KWINGOCHAT_TOKEN ?? "").trim() || null,
  };
}

/**
 * Connecte JAMAAL au compte KwingoChat / Jamaal Luxury depuis la fenêtre de connexion du back-office.
 * Supporte :
 * - Email + Mot de passe (+ Anon Key Supabase)
 * - Ou un Token d'accès / Clé API directe
 */
export async function connectKwingoAccount(input: {
  apiUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  email?: string;
  password?: string;
  accessToken?: string;
  companyId?: string;
  embedUrl?: string;
}): Promise<{ ok: boolean; error?: string; companyName?: string; companyId?: string | null }> {
  const envCfg = kwingoBridgeConfig();
  const apiUrl = (input.apiUrl?.trim() || envCfg.apiUrl).replace(/\/+$/, "");
  const supabaseUrl = (input.supabaseUrl?.trim() || envCfg.supabaseUrl).replace(/\/+$/, "");
  const supabaseAnonKey = (input.supabaseAnonKey?.trim() || envCfg.supabaseAnonKey).trim();
  const embedUrl = (input.embedUrl?.trim() || envCfg.embedUrl || "").replace(/\/+$/, "");

  let accessToken = (input.accessToken ?? "").trim();
  let refreshToken: string | null = null;
  let expiresAt: number | null = null;
  let resolvedEmail = (input.email ?? "").trim();

  // 1. Si Email + Mot de passe fournis :
  //    - Authentification directe via Supabase Auth de KwingoChat (évite le middleware CSRF 403 de /api/v1)
  //    - Repli sur POST ${apiUrl}/auth/login uniquement si Supabase Auth n'est pas configuré
  if (!accessToken) {
    if (!resolvedEmail || !input.password) {
      return {
        ok: false,
        error: "Renseignez votre Email et votre Mot de passe KwingoChat.",
      };
    }

    if (supabaseUrl && supabaseAnonKey) {
      const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          email: resolvedEmail,
          password: input.password,
        }),
        signal: AbortSignal.timeout(10_000),
      }).catch((e) => {
        throw new Error(`Impossible de joindre Supabase Auth : ${e instanceof Error ? e.message : "erreur réseau"}`);
      });

      if (!authRes.ok) {
        const errJson = (await authRes.json().catch(() => null)) as {
          error_description?: string;
          msg?: string;
          message?: string;
        } | null;
        return {
          ok: false,
          error:
            errJson?.error_description ||
            errJson?.msg ||
            errJson?.message ||
            `Identifiants KwingoChat refusés (HTTP ${authRes.status}).`,
        };
      }

      const authData = (await authRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_at?: number;
        expires_in?: number;
        user?: { email?: string };
      };
      accessToken = authData.access_token;
      refreshToken = authData.refresh_token ?? null;
      expiresAt = authData.expires_at ?? (authData.expires_in ? Math.floor(Date.now() / 1000) + authData.expires_in : null);
      if (authData.user?.email) resolvedEmail = authData.user.email;
    } else {
      const kwingoLoginRes = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resolvedEmail,
          password: input.password,
        }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);

      if (!kwingoLoginRes || !kwingoLoginRes.ok) {
        return {
          ok: false,
          error: "Variables KWINGOCHAT_SUPABASE_URL / KWINGOCHAT_SUPABASE_ANON_KEY manquantes sur le serveur.",
        };
      }

      const loginJson = (await kwingoLoginRes.json()) as {
        data?: {
          access_token?: string;
          refresh_token?: string;
          expires_at?: number;
          expires_in?: number;
          company_id?: string;
          user?: { email?: string };
        };
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        expires_in?: number;
      };
      const payload = loginJson.data ?? loginJson;
      accessToken = payload.access_token ?? "";
      refreshToken = payload.refresh_token ?? null;
      expiresAt = payload.expires_at ?? (payload.expires_in ? Math.floor(Date.now() / 1000) + payload.expires_in : null);
      if (loginJson.data?.user?.email) resolvedEmail = loginJson.data.user.email;
      if (loginJson.data?.company_id && !input.companyId) {
        input.companyId = loginJson.data.company_id;
      }
    }
  }

  // 2. Vérifie le token auprès de l'API KwingoChat et détecte automatiquement le company_id de Jamaal Luxury
  let companyId = (input.companyId ?? "").trim() || null;
  let companyName = "Jamaal Luxury";

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "X-Bridge-Secret": accessToken,
  };
  if (companyId) headers["X-Company-Id"] = companyId;

  // Si l'utilisateur est SuperAdmin sur KwingoChat, cherche d'abord l'entreprise "Jamaal Luxury" dans /supervision/companies
  if (!companyId) {
    const supRes = await fetch(`${apiUrl}/supervision/companies`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null);
    if (supRes?.ok) {
      const supJson = (await supRes.json().catch(() => null)) as {
        data?: { id?: string; name?: string }[];
      } | null;
      const list = Array.isArray(supJson?.data) ? supJson.data : [];
      const jamaalComp = list.find((c) => /jamaal/i.test(c.name ?? ""));
      if (jamaalComp?.id) {
        companyId = jamaalComp.id;
        companyName = jamaalComp.name || "Jamaal Luxury";
        headers["X-Company-Id"] = companyId;
      }
    }
  }

  const teamRes = await fetch(`${apiUrl}/team/members`, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (teamRes) {
    const teamJson = (await teamRes.json().catch(() => null)) as {
      success?: boolean;
      data?: { company_id?: string; company_name?: string };
      error?: { code?: string; message?: string; details?: { companies?: string[] } };
    } | null;

    // Si le compte appartient à plusieurs entreprises, cherche celle qui s'appelle Jamaal Luxury
    if (teamRes.status === 400 && teamJson?.error?.code === "COMPANY_ID_REQUIRED") {
      const companies = teamJson.error.details?.companies ?? [];
      for (const candidateId of companies) {
        const retryRes = await fetch(`${apiUrl}/team/members`, {
          method: "GET",
          headers: { ...headers, "X-Company-Id": candidateId },
          signal: AbortSignal.timeout(8_000),
        }).catch(() => null);
        if (retryRes?.ok) {
          const retryJson = (await retryRes.json().catch(() => null)) as {
            data?: { company_id?: string; company_name?: string };
          } | null;
          const cName = retryJson?.data?.company_name ?? "";
          if (!companyId || /jamaal/i.test(cName)) {
            companyId = retryJson?.data?.company_id ?? candidateId;
            companyName = cName || companyName;
            if (/jamaal/i.test(cName)) break;
          }
        }
      }
    } else if (teamRes.ok) {
      companyId = teamJson?.data?.company_id ?? companyId;
      companyName = teamJson?.data?.company_name ?? companyName;
    } else if (teamRes.status === 401 || teamRes.status === 403) {
      return {
        ok: false,
        error: teamJson?.error?.message || "Session refusée par l'API KwingoChat (401/403).",
      };
    }
  }

  const toStore: KwingoStoredConnection = {
    apiUrl,
    supabaseUrl,
    supabaseAnonKey,
    email: resolvedEmail || "Jamaal Luxury",
    accessToken,
    refreshToken,
    expiresAt,
    companyId,
    companyName,
    embedUrl: embedUrl || null,
    connectedAt: new Date().toISOString(),
  };

  const encryptedToStore = encryptPayload(JSON.stringify(toStore));
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: encryptedToStore },
    update: { value: encryptedToStore },
  });

  return { ok: true, companyName, companyId };
}

export async function disconnectKwingoAccount(): Promise<void> {
  await prisma.setting.delete({ where: { key: SETTING_KEY } }).catch(() => {});
}

/**
 * Récupère en direct les conversations et messages du compte Jamaal Luxury sur KwingoChat,
 * les synchronise dans WhatsAppThread / WhatsAppMessage et applique le routage dynamique
 * vers le bon consultant JAMAAL (ou laisse dans unassigned s'il n'a pas de consultant).
 */
let lastChatListSyncAt = 0;
const lastThreadMsgsSyncAt = new Map<string, number>();

export async function syncLiveFromKwingo(activePhone?: string, force = false): Promise<boolean> {
  const conn = await getKwingoConnection();
  if (!conn.connected || !conn.accessToken) return false;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${conn.accessToken}`,
    "X-Bridge-Secret": conn.accessToken,
  };
  if (conn.companyId) headers["X-Company-Id"] = conn.companyId;

  // 1. Récupérer la liste des conversations depuis KwingoChat (/messages/chats) — au plus toutes les 30 s (sauf sync forcée)
  const shouldSyncList = force || Date.now() - lastChatListSyncAt > 30_000;
  if (shouldSyncList) {
    lastChatListSyncAt = Date.now();
    const chatsRes = await fetch(`${conn.apiUrl}/messages/chats?limit=80`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null);

    if (chatsRes?.ok) {
      const chatsJson = (await chatsRes.json().catch(() => null)) as {
        data?: {
          wa_id?: string;
          phone?: string;
          name?: string;
          lastMessage?: string;
          lastMessageTime?: string;
          lastMessageDirection?: string;
          assigned_to?: string | null;
        }[];
      } | null;

      const chats = Array.isArray(chatsJson?.data) ? chatsJson.data : Array.isArray(chatsJson) ? chatsJson : [];

      for (const chat of chats) {
        const rawPhone = chat.wa_id || chat.phone || "";
        const phone = canonicalizePhone(rawPhone);
        if (!phone || phone.length < 8) continue;

        const remoteAt = chat.lastMessageTime ? new Date(chat.lastMessageTime) : null;
        const known = await prisma.whatsAppThread
          .findUnique({ where: { phone }, select: { lastMessageAt: true } })
          .catch(() => null);

        const hasNewActivity =
          !known ||
          (remoteAt && !Number.isNaN(remoteAt.getTime()) && remoteAt.getTime() > known.lastMessageAt.getTime() + 1000);
        if (!hasNewActivity) continue;

        await routeInboundClientMessage({
          phone,
          profileName: chat.name || null,
          text: chat.lastMessage || null,
          messageAt: remoteAt,
        }).catch(() => {});

        if (chat.lastMessage) {
          const hasMsg = await prisma.whatsAppMessage.findFirst({
            where: { toNumber: phone },
            select: { id: true },
          });
          if (!hasMsg) {
            const isIn = chat.lastMessageDirection !== "outbound";
            const msgDate = remoteAt && !Number.isNaN(remoteAt.getTime()) ? remoteAt : new Date();
            await prisma.whatsAppMessage
              .create({
                data: {
                  direction: isIn ? "IN" : "OUT",
                  toNumber: phone,
                  kind: isIn ? "inbound" : "conseiller",
                  body: chat.lastMessage.slice(0, 1500),
                  status: isIn ? "RECU" : "ENVOYE",
                  createdAt: msgDate,
                },
              })
              .catch(() => {});
          }
        }
      }
    }
  }

  // 2. Si une conversation est sélectionnée, récupérer ses messages détaillés depuis KwingoChat (au plus toutes les 10 s sauf sync forcée)
  if (activePhone) {
    const lastForPhone = lastThreadMsgsSyncAt.get(activePhone) ?? 0;
    if (force || Date.now() - lastForPhone > 10_000) {
      lastThreadMsgsSyncAt.set(activePhone, Date.now());
      const msgRes = await fetch(`${conn.apiUrl}/messages/${encodeURIComponent(activePhone)}?limit=80`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(8_000),
      }).catch(() => null);

      if (msgRes?.ok) {
        const msgJson = (await msgRes.json().catch(() => null)) as {
          data?:
            | {
                id?: string;
                meta_message_id?: string | null;
                body?: string;
                direction?: string;
                status?: string;
                created_at?: string;
              }[]
            | {
                messages?: {
                  id?: string;
                  meta_message_id?: string | null;
                  body?: string;
                  direction?: string;
                  status?: string;
                  created_at?: string;
                }[];
              };
        } | null;

        const remoteMsgs = Array.isArray(msgJson?.data)
          ? msgJson.data
          : msgJson?.data?.messages ?? [];

        let newestDate: Date | null = null;
        for (const rm of remoteMsgs) {
          if (!rm.body) continue;
          const bodyClean = rm.body.slice(0, 1500);
          const isIn = rm.direction === "inbound";
          const dir = isIn ? "IN" : "OUT";
          const msgDate = rm.created_at ? new Date(rm.created_at) : null;
          if (msgDate && !Number.isNaN(msgDate.getTime()) && (!newestDate || msgDate > newestDate)) {
            newestDate = msgDate;
          }

          const providerId = rm.meta_message_id || (rm.id ? `kwingo:${rm.id}` : null);
          if (providerId) {
            const exists = await prisma.whatsAppMessage.findFirst({
              where: { providerId },
              select: { id: true },
            });
            if (exists) continue;
          }

          // Évite les doublons si le même message existe déjà sans providerId dans une fenêtre de ±2 min
          if (msgDate && !Number.isNaN(msgDate.getTime())) {
            const dup = await prisma.whatsAppMessage.findFirst({
              where: {
                toNumber: activePhone,
                direction: dir,
                body: bodyClean,
                createdAt: {
                  gte: new Date(msgDate.getTime() - 120_000),
                  lte: new Date(msgDate.getTime() + 120_000),
                },
              },
              select: { id: true },
            });
            if (dup) continue;
          }

          await prisma.whatsAppMessage
            .create({
              data: {
                direction: dir,
                toNumber: activePhone,
                kind: isIn ? "inbound" : "conseiller",
                body: bodyClean,
                status: isIn ? "RECU" : rm.status === "read" ? "LU" : rm.status === "delivered" ? "LIVRE" : "ENVOYE",
                providerId,
                ...(msgDate && !Number.isNaN(msgDate.getTime()) ? { createdAt: msgDate } : {}),
              },
            })
            .catch(() => {});
        }

        if (newestDate) {
          await prisma.whatsAppThread
            .update({
              where: { phone: activePhone },
              data: { lastMessageAt: newestDate },
            })
            .catch(() => {});
        }
      }
    }
  }

  return true;
}

/**
 * Envoie un message WhatsApp via l'API KwingoChat (compte Jamaal Luxury) si la connexion est active.
 * Renvoie `null` si KwingoChat n'est pas connecté (pour permettre le repli sur l'envoi Meta direct / simulation).
 */
export interface MetaApprovedTemplate {
  id: string;
  title: string;
  templateName: string;
  language: string;
  category: string;
  text: string;
  isMetaApproved: true;
  paramCount?: number;
  exampleParams?: string[];
}

let metaTemplatesCache: { expiresAt: number; data: MetaApprovedTemplate[] } | null = null;

/**
 * Formate le corps d'un modèle Meta en remplaçant {{1}} par {prenom}
 * et {{2}}, {{3}}... par leurs valeurs d'exemple Meta pour un aperçu lisible.
 */
function formatMetaTemplateBody(rawBody: string, examples: string[]): string {
  return rawBody
    .replace(/\{\{(\d+)\}\}/g, (_match, idxStr) => {
      const idx = Number(idxStr) - 1;
      if (idx === 0) return "{prenom}";
      return (examples[idx] ?? "").trim() || `Info ${idx + 1}`;
    })
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Récupère les modèles WhatsApp réellement approuvés par Meta depuis KwingoChat
 * (compte Jamaal Luxury, via GET /api/v1/templates/sync), avec cache mémoire de 5 min.
 */
export async function fetchKwingoMetaTemplates(opts: { forceRefresh?: boolean } = {}): Promise<MetaApprovedTemplate[]> {
  if (!opts.forceRefresh && metaTemplatesCache && metaTemplatesCache.expiresAt > Date.now()) {
    return metaTemplatesCache.data;
  }

  const results: MetaApprovedTemplate[] = [];
  const seen = new Set<string>();

  const conn = await getKwingoConnection();
  if (conn.connected && conn.accessToken) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${conn.accessToken}`,
      "X-Bridge-Secret": conn.accessToken,
    };
    if (conn.companyId) headers["X-Company-Id"] = conn.companyId;

    for (const ep of ["/templates/sync", "/campaigns/templates/sync", "/settings/templates/sync"]) {
      const res = await fetch(`${conn.apiUrl}${ep}`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(8_000),
      }).catch(() => null);

      if (!res?.ok) continue;
      const json = (await res.json().catch(() => null)) as {
        data?: {
          id?: string;
          name?: string;
          language?: string;
          category?: string;
          status?: string;
          body_text?: string;
          header_text?: string;
          components?: {
            type?: string;
            text?: string;
            example?: { body_text?: string[][] };
          }[];
        }[];
      } | null;

      const list = Array.isArray(json?.data) ? json.data : [];
      for (const t of list) {
        if (!t.name || (t.status && t.status.toUpperCase() !== "APPROVED")) continue;
        if (!t.components && !t.body_text && !t.category) continue;
        const key = `${t.name}:${t.language || "fr"}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const bodyComp = Array.isArray(t.components)
          ? t.components.find((c) => (c.type ?? "").toUpperCase() === "BODY")
          : null;
        const rawBody = t.body_text || bodyComp?.text || `Bonjour {{1}}, message de JAMAAL Luxury.`;
        const examples = bodyComp?.example?.body_text?.[0]?.map((v) => String(v).trim()) ?? [];
        const matches = rawBody.match(/\{\{\d+\}\}/g) ?? [];

        results.push({
          id: `meta:${t.name}:${t.language || "fr"}`,
          title: `${t.name} · ${t.category || "UTILITY"} (${t.language || "fr"})`,
          templateName: t.name,
          language: t.language || "fr",
          category: t.category || "UTILITY",
          text: formatMetaTemplateBody(rawBody, examples),
          isMetaApproved: true,
          paramCount: matches.length,
          exampleParams: examples,
        });
      }
      if (results.length > 0) break;
    }
  }

  if (results.length > 0) {
    metaTemplatesCache = {
      expiresAt: Date.now() + 5 * 60 * 1000,
      data: results,
    };
    return results;
  }

  // Repli uniquement si KwingoChat est hors-ligne : modèle universel Meta hello_world
  return [
    {
      id: "meta:hello_world:en_US",
      title: "hello_world · Modèle standard Meta (en_US)",
      templateName: "hello_world",
      language: "en_US",
      category: "UTILITY",
      text: "Welcome and congratulations! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API.",
      isMetaApproved: true,
      paramCount: 0,
      exampleParams: [],
    },
  ];
}

export async function sendViaKwingoConnection(opts: {
  to: string;
  text: string;
  free?: boolean;
  windowOpen?: boolean;
  recipientName?: string | null;
  templateName?: string;
  templateLanguage?: string;
}): Promise<{ ok: boolean; providerId?: string; simulated?: boolean; error?: string } | null> {
  // Numéros fictifs de démonstration locale : ne pas les envoyer à Meta via KwingoChat, les simuler proprement
  if (/^2217780010\d\d$|^2217650020\d\d$|^221776001122$|^221781234567$/.test(opts.to)) {
    return { ok: true, simulated: true, providerId: `sim-${Date.now()}` };
  }

  const conn = await getKwingoConnection();
  if (!conn.connected || !conn.accessToken) return null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${conn.accessToken}`,
    "X-Bridge-Secret": conn.accessToken,
  };
  if (conn.companyId) headers["X-Company-Id"] = conn.companyId;

  const isWindowOpen = opts.windowOpen ?? opts.free !== false;
  let wantsTemplate = Boolean(opts.templateName) && opts.free === false;

  let resolvedTemplateName = opts.templateName;
  let resolvedLanguage = opts.templateLanguage || "fr";
  let matchedTemplate: MetaApprovedTemplate | null = null;

  if (wantsTemplate) {
    const approvedList = await fetchKwingoMetaTemplates().catch(() => []);
    const exactMatch = approvedList.find(
      (t) =>
        t.templateName.toLowerCase() === (opts.templateName ?? "").toLowerCase() &&
        (!opts.templateLanguage || t.language.toLowerCase() === opts.templateLanguage.toLowerCase()),
    ) ?? approvedList.find((t) => t.templateName.toLowerCase() === (opts.templateName ?? "").toLowerCase());

    if (exactMatch) {
      matchedTemplate = exactMatch;
      resolvedTemplateName = exactMatch.templateName;
      resolvedLanguage = exactMatch.language;
    } else if (isWindowOpen) {
      // Le modèle demandé (ex: ancien fallback "jamaal_alerte") n'existe pas sur Meta,
      // mais la fenêtre 24h est ouverte : on envoie le texte personnalisé en message libre Cloud API.
      wantsTemplate = false;
    } else if (approvedList.length > 0) {
      // Fenêtre 24h fermée et modèle non trouvé : utiliser le premier modèle Meta français approuvé du compte
      const fallbackMeta = approvedList.find((t) => t.language.startsWith("fr")) ?? approvedList[0];
      matchedTemplate = fallbackMeta;
      resolvedTemplateName = fallbackMeta.templateName;
      resolvedLanguage = fallbackMeta.language;
    }
  }

  const buildTemplateComponents = (tpl: MetaApprovedTemplate | null) => {
    if (!tpl?.paramCount || tpl.paramCount <= 0) return undefined;
    const rawName = (opts.recipientName ?? "").trim();
    const firstName = rawName && !rawName.startsWith("+") ? rawName.split(/\s+/)[0] : "";
    if (!firstName) return undefined;
    const parameters = Array.from({ length: tpl.paramCount }, (_, idx) => ({
      type: "text",
      text: idx === 0 ? firstName : (tpl.exampleParams?.[idx]?.trim() || `Info ${idx + 1}`),
    }));
    return [{ type: "body", parameters }];
  };

  const buildPayload = (asTemplate: boolean) => {
    const components = asTemplate ? buildTemplateComponents(matchedTemplate) : undefined;
    return asTemplate
      ? {
          wa_id: opts.to,
          to: opts.to,
          type: "template",
          templateName: resolvedTemplateName,
          language: resolvedLanguage,
          body: opts.text,
          ...(components ? { components } : {}),
        }
      : {
          wa_id: opts.to,
          to: opts.to,
          type: "text",
          body: opts.text,
          message_body: opts.text,
        };
  };

  const postToKwingo = async (payload: Record<string, unknown>) => {
    const res = await fetch(`${conn.apiUrl}/messages/send`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    }).catch((e) => {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: e instanceof Error ? e.message : "Erreur réseau KwingoChat" }),
      } as Response;
    });

    const data = (await res.json().catch(() => null)) as {
      data?: { messages?: { id?: string }[] };
      messages?: { id?: string }[];
      error?: { message?: string } | string;
      message?: string;
    } | null;

    return { res, data };
  };

  let { res, data } = await postToKwingo(buildPayload(wantsTemplate));

  // Si l'envoi par modèle échoue (ex: #132001 traduction absente) alors que la fenêtre 24h est ouverte,
  // repli automatique immédiat en message texte Cloud API pour garantir la livraison.
  if (!res.ok && wantsTemplate && isWindowOpen) {
    const retry = await postToKwingo(buildPayload(false));
    res = retry.res;
    data = retry.data;
  }

  // Inversement, si un envoi texte échoue parce que la fenêtre 24h est fermée côté KwingoChat,
  // repli automatique sur un modèle Meta réellement approuvé du compte Jamaal Luxury.
  if (!res.ok && !wantsTemplate) {
    const errText =
      (typeof data?.error === "object" && data.error ? data.error.message : typeof data?.error === "string" ? data.error : null) ||
      data?.message ||
      "";
    if (/24h|window closed|template/i.test(errText)) {
      const approvedList = await fetchKwingoMetaTemplates().catch(() => []);
      const fallbackMeta = approvedList.find((t) => t.language.startsWith("fr")) ?? approvedList[0];
      if (fallbackMeta) {
        resolvedTemplateName = fallbackMeta.templateName;
        resolvedLanguage = fallbackMeta.language;
        const retry = await postToKwingo(buildPayload(true));
        res = retry.res;
        data = retry.data;
      }
    }
  }

  if (!res.ok) {
    const errMsg =
      (typeof data?.error === "object" && data.error ? data.error.message : typeof data?.error === "string" ? data.error : null) ||
      data?.message ||
      `Erreur KwingoChat (${res.status})`;
    return { ok: false, error: errMsg };
  }

  const msgId = data?.data?.messages?.[0]?.id ?? data?.messages?.[0]?.id;
  return { ok: true, providerId: msgId };
}

/**
 * Construit les attributs de contact normalisés (format KwingoChat `custom_attributes`).
 * Si `consultant` est null, `assigned_to` et `consultant_id` valent `null` (« unassigned »).
 */
export function buildContactCustomAttributes(
  consultant: ResolvedConsultant | null,
  extra: {
    previous?: Record<string, unknown> | null;
    campaignId?: string | null;
    campaignTitle?: string | null;
    assignedBy?: string | null;
    source?: RoutingSource;
  } = {},
): KwingoContactAttributes {
  const prev = (extra.previous && typeof extra.previous === "object" ? extra.previous : {}) as Record<string, unknown>;
  const nowIso = new Date().toISOString();
  const source: RoutingSource = extra.source ?? (consultant ? consultant.source : "UNASSIGNED");

  return {
    ...prev,
    assigned_to: consultant ? consultant.id : null,
    assigned_at: consultant ? (typeof prev.assigned_at === "string" && prev.assigned_to === consultant.id ? prev.assigned_at : nowIso) : null,
    assigned_by: extra.assignedBy !== undefined ? extra.assignedBy : (prev.assigned_by as string | null | undefined) ?? null,
    consultant_id: consultant ? consultant.id : null,
    consultant_name: consultant ? consultant.name : null,
    consultant_email: consultant ? consultant.email : null,
    consultant_phone: consultant ? consultant.whatsapp : null,
    consultant_slug: consultant ? consultant.slug : null,
    routing_source: consultant ? source : "UNASSIGNED",
    ...(extra.campaignId !== undefined ? { campaign_id: extra.campaignId } : {}),
    ...(extra.campaignTitle !== undefined ? { campaign_title: extra.campaignTitle } : {}),
  };
}

/**
 * Extrait un slug de boutique consultant (`/c/<slug>` ou `?ref=<slug>`) éventuellement présent
 * dans un message spontané d'un client (pure, testable sans base).
 */
export function extractConsultantSlugFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const shopMatch = text.match(/\/c\/([a-z0-9][a-z0-9-_]{1,60})/i);
  if (shopMatch?.[1]) return shopMatch[1].toLowerCase();
  const refMatch = text.match(/[?&]ref=([a-z0-9][a-z0-9-_]{1,60})/i);
  if (refMatch?.[1]) return refMatch[1].toLowerCase();
  return null;
}

/**
 * Résout dynamiquement le consultant actif rattaché à un client à partir de son numéro WhatsApp
 * (et éventuellement du texte de son message spontané).
 */
export async function resolveClientConsultant(
  rawPhone: string,
  messageText?: string | null,
): Promise<ResolvedConsultant | null> {
  // 1. Lien explicite de boutique revendeur dans le message spontané
  const slug = extractConsultantSlugFromText(messageText);
  if (slug) {
    const bySlug = await prisma.consultant.findFirst({
      where: { slug: { equals: slug, mode: "insensitive" }, active: true },
      select: { id: true, name: true, email: true, whatsapp: true, slug: true, city: true },
    });
    if (bySlug) {
      return { ...bySlug, source: "LIEN_BOUTIQUE" };
    }
  }

  const tail = phoneTail(rawPhone);
  if (!tail) return null;

  // 2. Fiche Customer ayant déjà un consultantId actif
  const customerRows = await prisma.$queryRaw<
    { id: string; name: string; email: string | null; whatsapp: string; slug: string | null; city: string }[]
  >`
    SELECT cons.id, cons.name, cons.email, cons.whatsapp, cons.slug, cons.city
    FROM "Customer" c
    JOIN "Consultant" cons ON cons.id = c."consultantId" AND cons.active = true
    WHERE right(regexp_replace(c.phone, '[^0-9]', '', 'g'), 9) = ${tail}
    ORDER BY c."updatedAt" DESC
    LIMIT 1
  `.catch(() => []);
  if (customerRows[0]) {
    return { ...customerRows[0], source: "ROUTAGE_CLIENT" };
  }

  // 3. Dernière commande non annulée avec un consultant actif
  const orderRows = await prisma.$queryRaw<
    { id: string; name: string; email: string | null; whatsapp: string; slug: string | null; city: string }[]
  >`
    SELECT cons.id, cons.name, cons.email, cons.whatsapp, cons.slug, cons.city
    FROM "Order" o
    LEFT JOIN "Customer" c ON c.id = o."customerId"
    JOIN "Consultant" cons ON cons.id = o."consultantId" AND cons.active = true
    WHERE o.status <> 'ANNULEE'
      AND o."consultantId" IS NOT NULL
      AND (
        right(regexp_replace(coalesce(o."customerPhone", ''), '[^0-9]', '', 'g'), 9) = ${tail}
        OR right(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'), 9) = ${tail}
      )
    ORDER BY o."createdAt" DESC
    LIMIT 1
  `.catch(() => []);
  if (orderRows[0]) {
    await prisma.$executeRaw`
      UPDATE "Customer"
      SET "consultantId" = ${orderRows[0].id}
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ${tail}
        AND "consultantId" IS NULL
    `.catch(() => {});
    return { ...orderRows[0], source: "ROUTAGE_CLIENT" };
  }

  // 4. Dernier panier abandonné avec un consultant actif
  const cartRows = await prisma.$queryRaw<
    { id: string; name: string; email: string | null; whatsapp: string; slug: string | null; city: string }[]
  >`
    SELECT cons.id, cons.name, cons.email, cons.whatsapp, cons.slug, cons.city
    FROM "AbandonedCart" ac
    JOIN "Consultant" cons ON cons.id = ac."consultantId" AND cons.active = true
    WHERE ac."consultantId" IS NOT NULL
      AND right(regexp_replace(ac.phone, '[^0-9]', '', 'g'), 9) = ${tail}
    ORDER BY ac."updatedAt" DESC
    LIMIT 1
  `.catch(() => []);
  if (cartRows[0]) {
    return { ...cartRows[0], source: "ROUTAGE_CLIENT" };
  }

  // 5. Abonnement, Carte cadeau ou Parrainage
  const subOrReferralRows = await prisma.$queryRaw<
    { id: string; name: string; email: string | null; whatsapp: string; slug: string | null; city: string }[]
  >`
    SELECT cons.id, cons.name, cons.email, cons.whatsapp, cons.slug, cons.city
    FROM (
      SELECT s."consultantId", s."createdAt"
      FROM "Subscription" s
      WHERE s."consultantId" IS NOT NULL
        AND right(regexp_replace(s."customerPhone", '[^0-9]', '', 'g'), 9) = ${tail}
      UNION ALL
      SELECT g."consultantId", g."createdAt"
      FROM "GiftCard" g
      WHERE g."consultantId" IS NOT NULL
        AND (
          right(regexp_replace(g."recipientPhone", '[^0-9]', '', 'g'), 9) = ${tail}
          OR right(regexp_replace(coalesce(g."buyerPhone", ''), '[^0-9]', '', 'g'), 9) = ${tail}
        )
      UNION ALL
      SELECT r."referrerId" AS "consultantId", r."createdAt"
      FROM "Referral" r
      JOIN "Customer" c ON c.id = r."usedById"
      WHERE r."referrerId" IS NOT NULL
        AND right(regexp_replace(c.phone, '[^0-9]', '', 'g'), 9) = ${tail}
    ) linked
    JOIN "Consultant" cons ON cons.id = linked."consultantId" AND cons.active = true
    ORDER BY linked."createdAt" DESC
    LIMIT 1
  `.catch(() => []);
  if (subOrReferralRows[0]) {
    return { ...subOrReferralRows[0], source: "ROUTAGE_CLIENT" };
  }

  return null;
}

/**
 * Lors de l'envoi d'une campagne WhatsApp, assigne le contact à son consultant via les attributs
 * de contact (`customAttributes`) afin que tout retour du client sur cette campagne arrive
 * automatiquement chez ce consultant (ou reste dans `unassigned` s'il n'en a pas).
 */
export async function assignCampaignRecipientAttributes(opts: {
  phone: string;
  name?: string | null;
  consultantId?: string | null;
  campaignId: string;
  campaignTitle?: string | null;
}): Promise<{ consultant: ResolvedConsultant | null; customAttributes: KwingoContactAttributes }> {
  const phone = canonicalizePhone(opts.phone);
  let consultant: ResolvedConsultant | null = null;

  if (opts.consultantId) {
    const found = await prisma.consultant.findFirst({
      where: { id: opts.consultantId, active: true },
      select: { id: true, name: true, email: true, whatsapp: true, slug: true, city: true },
    });
    if (found) {
      consultant = { ...found, source: "CAMPAGNE" };
    }
  } else {
    const resolved = await resolveClientConsultant(phone);
    if (resolved) {
      consultant = { ...resolved, source: "CAMPAGNE" };
    }
  }

  const existingThread = await prisma.whatsAppThread
    .findUnique({ where: { phone }, select: { customAttributes: true, consultantId: true } })
    .catch(() => null);

  if (!consultant && existingThread?.consultantId) {
    const prevCons = await prisma.consultant
      .findFirst({
        where: { id: existingThread.consultantId, active: true },
        select: { id: true, name: true, email: true, whatsapp: true, slug: true, city: true },
      })
      .catch(() => null);
    if (prevCons) consultant = { ...prevCons, source: "CAMPAGNE" };
  }

  const customAttributes = buildContactCustomAttributes(consultant, {
    previous: (existingThread?.customAttributes as Record<string, unknown> | null) ?? null,
    campaignId: opts.campaignId,
    campaignTitle: opts.campaignTitle ?? null,
    source: consultant ? "CAMPAGNE" : "UNASSIGNED",
  });

  const now = new Date();
  await prisma.whatsAppThread
    .upsert({
      where: { phone },
      create: {
        phone,
        name: opts.name ?? null,
        lastMessageAt: now,
        consultantId: consultant?.id ?? null,
        assignedAt: consultant ? now : null,
        assignedSource: consultant ? "CAMPAGNE" : null,
        customAttributes: customAttributes as unknown as Prisma.InputJsonValue,
      },
      update: {
        lastMessageAt: now,
        ...(opts.name ? { name: opts.name } : {}),
        consultantId: consultant?.id ?? null,
        assignedAt: consultant ? now : null,
        assignedSource: consultant ? "CAMPAGNE" : null,
        customAttributes: customAttributes as unknown as Prisma.InputJsonValue,
      },
    })
    .catch((e) => console.error("[kwingo-bridge] upsert campaign thread", e));

  void syncContactToKwingoApi({
    phone,
    name: opts.name ?? null,
    customAttributes,
  }).catch(() => {});

  return { consultant, customAttributes };
}

/**
 * Routage automatique d'un message entrant (retour de campagne OU message spontané d'un client).
 */
export async function routeInboundClientMessage(opts: {
  phone: string;
  profileName?: string | null;
  text?: string | null;
  /** Date réelle du message (synchronisation KwingoChat). Par défaut : maintenant (message reçu en direct). */
  messageAt?: Date | null;
}): Promise<{ consultant: ResolvedConsultant | null; customAttributes: KwingoContactAttributes; routing: RoutingSource }> {
  const phone = canonicalizePhone(opts.phone);
  const now = new Date();
  const msgAt = opts.messageAt && !Number.isNaN(opts.messageAt.getTime()) ? opts.messageAt : now;

  const existingThread = await prisma.whatsAppThread
    .findUnique({
      where: { phone },
      include: {
        consultant: { select: { id: true, name: true, email: true, whatsapp: true, slug: true, city: true, active: true } },
      },
    })
    .catch(() => null);

  const prevAttrs =
    existingThread?.customAttributes && typeof existingThread.customAttributes === "object"
      ? (existingThread.customAttributes as Record<string, unknown>)
      : {};

  const explicitSlug = extractConsultantSlugFromText(opts.text);
  let consultant: ResolvedConsultant | null = null;
  let routing: RoutingSource = "UNASSIGNED";

  if (explicitSlug) {
    const bySlug = await prisma.consultant
      .findFirst({
        where: { slug: { equals: explicitSlug, mode: "insensitive" }, active: true },
        select: { id: true, name: true, email: true, whatsapp: true, slug: true, city: true },
      })
      .catch(() => null);
    if (bySlug) {
      consultant = { ...bySlug, source: "LIEN_BOUTIQUE" };
      routing = "LIEN_BOUTIQUE";
    }
  }

  if (!consultant && existingThread?.consultant && existingThread.consultant.active) {
    const src =
      existingThread.assignedSource === "CAMPAGNE" || prevAttrs.routing_source === "CAMPAGNE"
        ? "CAMPAGNE"
        : existingThread.assignedSource === "MANUEL" || prevAttrs.routing_source === "MANUEL"
          ? "MANUEL"
          : "ROUTAGE_CLIENT";
    consultant = {
      id: existingThread.consultant.id,
      name: existingThread.consultant.name,
      email: existingThread.consultant.email,
      whatsapp: existingThread.consultant.whatsapp,
      slug: existingThread.consultant.slug,
      city: existingThread.consultant.city,
      source: src,
    };
    routing = src;
  } else if (!consultant && typeof prevAttrs.consultant_id === "string" && prevAttrs.consultant_id) {
    const fromAttr = await prisma.consultant
      .findFirst({
        where: { id: prevAttrs.consultant_id, active: true },
        select: { id: true, name: true, email: true, whatsapp: true, slug: true, city: true },
      })
      .catch(() => null);
    if (fromAttr) {
      const src = prevAttrs.routing_source === "CAMPAGNE" ? "CAMPAGNE" : "ROUTAGE_CLIENT";
      consultant = { ...fromAttr, source: src };
      routing = src;
    }
  }

  if (!consultant) {
    const dynamicallyResolved = await resolveClientConsultant(phone, opts.text);
    if (dynamicallyResolved) {
      consultant = dynamicallyResolved;
      routing = dynamicallyResolved.source;
    } else {
      consultant = null;
      routing = "UNASSIGNED";
    }
  }

  const customAttributes = buildContactCustomAttributes(consultant, {
    previous: prevAttrs,
    source: routing,
  });

  // Ne jamais faire reculer ni « rajeunir » artificiellement la date du dernier message :
  // on garde la plus récente entre la date connue et la date réelle du message.
  const prevLast = existingThread?.lastMessageAt ? new Date(existingThread.lastMessageAt) : null;
  const nextLastMessageAt = prevLast && prevLast.getTime() > msgAt.getTime() ? prevLast : msgAt;

  await prisma.whatsAppThread
    .upsert({
      where: { phone },
      create: {
        phone,
        name: opts.profileName ?? null,
        lastMessageAt: msgAt,
        consultantId: consultant?.id ?? null,
        assignedAt: consultant ? now : null,
        assignedSource: consultant ? routing : null,
        customAttributes: customAttributes as unknown as Prisma.InputJsonValue,
      },
      update: {
        lastMessageAt: nextLastMessageAt,
        ...(opts.profileName ? { name: opts.profileName } : {}),
        consultantId: consultant?.id ?? null,
        assignedAt: consultant ? (existingThread?.assignedAt ?? now) : null,
        assignedSource: consultant ? routing : null,
        customAttributes: customAttributes as unknown as Prisma.InputJsonValue,
      },
    })
    .catch((e) => console.error("[kwingo-bridge] upsert inbound thread", e));

  void syncContactToKwingoApi({
    phone,
    name: opts.profileName ?? existingThread?.name ?? null,
    customAttributes,
  }).catch(() => {});

  return { consultant, customAttributes, routing };
}

/**
 * Réassignation manuelle d'une conversation (par un administrateur) à un consultant ou en `unassigned` (`null`).
 */
export async function assignThreadToConsultant(opts: {
  phone: string;
  consultantId: string | null;
  assignedByUserId?: string | null;
}): Promise<{ consultant: ResolvedConsultant | null; customAttributes: KwingoContactAttributes }> {
  const phone = canonicalizePhone(opts.phone);
  let consultant: ResolvedConsultant | null = null;

  if (opts.consultantId) {
    const found = await prisma.consultant.findFirst({
      where: { id: opts.consultantId, active: true },
      select: { id: true, name: true, email: true, whatsapp: true, slug: true, city: true },
    });
    if (found) {
      consultant = { ...found, source: "MANUEL" };
    }
  }

  const existing = await prisma.whatsAppThread
    .findUnique({ where: { phone }, select: { customAttributes: true, name: true } })
    .catch(() => null);

  const customAttributes = buildContactCustomAttributes(consultant, {
    previous: (existing?.customAttributes as Record<string, unknown> | null) ?? null,
    assignedBy: opts.assignedByUserId ?? null,
    source: consultant ? "MANUEL" : "UNASSIGNED",
  });

  const now = new Date();
  await prisma.whatsAppThread.upsert({
    where: { phone },
    create: {
      phone,
      lastMessageAt: now,
      consultantId: consultant?.id ?? null,
      assignedAt: consultant ? now : null,
      assignedSource: consultant ? "MANUEL" : null,
      customAttributes: customAttributes as unknown as Prisma.InputJsonValue,
    },
    update: {
      consultantId: consultant?.id ?? null,
      assignedAt: consultant ? now : null,
      assignedSource: consultant ? "MANUEL" : null,
      customAttributes: customAttributes as unknown as Prisma.InputJsonValue,
    },
  });

  const tail = phoneTail(phone);
  if (tail) {
    await prisma.$executeRaw`
      UPDATE "Customer"
      SET "consultantId" = ${consultant?.id ?? null}
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ${tail}
    `.catch(() => {});
  }

  void syncContactToKwingoApi({
    phone,
    name: existing?.name ?? null,
    customAttributes,
  }).catch(() => {});

  return { consultant, customAttributes };
}

/**
 * Synchronise un contact et ses `custom_attributes` vers le backend KwingoChat (Option A API)
 * en utilisant la session KwingoChat enregistrée (ou les variables `.env`).
 */
export async function syncContactToKwingoApi(opts: {
  phone: string;
  name?: string | null;
  customAttributes: KwingoContactAttributes;
}): Promise<void> {
  const conn = await getKwingoConnection();
  if (!conn.connected || !conn.accessToken) return;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${conn.accessToken}`,
    "X-Bridge-Secret": conn.accessToken,
  };
  if (conn.companyId) headers["X-Company-Id"] = conn.companyId;

  // Cherche d'abord si le contact existe déjà dans KwingoChat
  const searchRes = await fetch(`${conn.apiUrl}/contacts?search=${encodeURIComponent(opts.phone)}`, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);

  let kwingoId: string | undefined;
  if (searchRes?.ok) {
    const searchJson = (await searchRes.json().catch(() => null)) as {
      data?: { id?: string; phone?: string }[];
      contacts?: { id?: string; phone?: string }[];
    } | null;
    const list = Array.isArray(searchJson?.data)
      ? searchJson.data
      : Array.isArray(searchJson?.contacts)
        ? searchJson.contacts
        : [];
    const matched = list.find((c) => phoneTail(c.phone) === phoneTail(opts.phone));
    if (matched?.id) {
      kwingoId = matched.id;
      await fetch(`${conn.apiUrl}/contacts/${matched.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name: opts.name || undefined,
          custom_attributes: opts.customAttributes,
          assigned_to: opts.customAttributes.assigned_to,
        }),
        signal: AbortSignal.timeout(8_000),
      }).catch(() => null);
    }
  }

  if (!kwingoId) {
    const createRes = await fetch(`${conn.apiUrl}/contacts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: opts.phone,
        name: opts.name || `Client ${opts.phone.slice(-4)}`,
        opt_in_status: true,
        custom_attributes: opts.customAttributes,
        assigned_to: opts.customAttributes.assigned_to,
      }),
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null);

    if (createRes?.ok) {
      const data = (await createRes.json().catch(() => null)) as { data?: { id?: string }; id?: string } | null;
      kwingoId = data?.data?.id ?? data?.id;
    }
  }

  if (kwingoId) {
    await prisma.whatsAppThread
      .update({ where: { phone: opts.phone }, data: { kwingoContactId: kwingoId } })
      .catch(() => {});
  }
}
