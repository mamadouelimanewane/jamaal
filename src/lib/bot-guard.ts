/**
 * Robot anti-aspiration : règles pures (testées), appliquées par le proxy à chaque requête.
 *
 * Ce qu'il bloque :
 * - les aspirateurs de sites et outils de copie (HTTrack, Wget, WebCopier, SiteSucker…), les scripts
 *   (curl, python-requests, Scrapy, Go, Java…), les navigateurs sans écran (HeadlessChrome, PhantomJS),
 *   les robots d'IA et d'analyse SEO qui copient le contenu (GPTBot, CCBot, ClaudeBot, Bytespider, Ahrefs…) ;
 * - toute requête sans navigateur déclaré (User-Agent vide) ;
 * - les visiteurs qui enchaînent trop de pages trop vite (limites par minute, heure et jour) ;
 * - quiconque suit le lien piège invisible (que seuls les aspirateurs suivent) : bannissement 24 h.
 *
 * Ce qu'il laisse passer :
 * - les moteurs de recherche et les aperçus de liens (Google, Bing, WhatsApp, Facebook, Telegram…),
 *   avec des limites plus larges ;
 * - les services techniques sur leurs adresses dédiées (webhooks WhatsApp et paiement, tâches Vercel).
 *
 * Aucun dispositif n'empêche totalement la copie d'un site public : celui-ci la rend lente, détectable
 * et coûteuse, et protège les données (catalogue complet, exports) derrière une clé ou une connexion.
 */

export type AgentKind = "bad" | "good" | "human";

/** Aspirateurs, scripts, navigateurs sans écran, robots d'IA et d'analyse SEO. */
const BAD_AGENTS = [
  // Aspirateurs de sites / copie hors ligne
  "httrack", "webcopier", "webzip", "offline explorer", "teleport", "sitesucker", "webreaper", "website downloader",
  "web downloader", "webstripper", "webwhacker", "getright", "go!zilla", "pagenest", "backstreet browser", "blackwidow",
  "wget", "curl/", "libcurl", "httpie", "aria2", "lwp-", "libwww", "winhttp", "wininet",
  // Bibliothèques de scripts
  "python-requests", "python-urllib", "python-httpx", "aiohttp", "scrapy", "mechanize", "go-http-client", "java/", "okhttp",
  "apache-httpclient", "node-fetch", "undici", "axios/", "got (", "ruby", "perl", "php/", "guzzle", "rest-client", "postmanruntime", "insomnia",
  // Navigateurs automatisés
  "headlesschrome", "phantomjs", "slimerjs", "puppeteer", "playwright", "selenium", "webdriver", "crawler4j",
  // Robots d'IA / copie de contenu
  "gptbot", "chatgpt-user", "oai-searchbot", "ccbot", "claudebot", "claude-web", "anthropic-ai", "bytespider", "perplexitybot",
  "amazonbot", "diffbot", "omgili", "magpie-crawler", "imagesiftbot", "cohere-ai", "meta-externalagent", "youbot", "timpibot",
  "ai2bot", "scrapy", "img2dataset", "friendlycrawler", "velenpublicwebcrawler", "webzio",
  // Analyse SEO / archivage (copient tout le site)
  "ahrefsbot", "semrushbot", "mj12bot", "dotbot", "blexbot", "petalbot", "dataforseobot", "serpstatbot", "seokicks", "screaming frog",
  "siteauditbot", "megaindex", "zoominfobot", "ia_archiver", "archive.org_bot", "heritrix", "nutch", "httrack",
];

/** Moteurs de recherche et aperçus de liens (WhatsApp, réseaux sociaux) : utiles au site. */
const GOOD_AGENTS = [
  "googlebot", "google-inspectiontool", "googleother", "adsbot-google", "mediapartners-google", "storebot-google", "google-site-verification",
  "bingbot", "bingpreview", "duckduckbot", "applebot", "yandexbot", "qwantify", "ecosia",
  "facebookexternalhit", "facebot", "facebookcatalog", "whatsapp", "telegrambot", "twitterbot", "linkedinbot", "pinterest", "slackbot", "discordbot", "skypeuripreview",
  "vercel-", "vercelbot",
];

export function classifyAgent(userAgent: string | null | undefined): AgentKind {
  const ua = (userAgent ?? "").toLowerCase().trim();
  if (ua.length < 8) return "bad"; // vide ou fantaisiste : aucun vrai navigateur n'envoie ça
  if (GOOD_AGENTS.some((g) => ua.includes(g))) return "good";
  if (BAD_AGENTS.some((b) => ua.includes(b))) return "bad";
  return "human";
}

/** Adresses que des services techniques appellent sans navigateur : jamais filtrées. */
const MACHINE_PATHS = [
  "/api/whatsapp/webhook",
  "/api/payment/",
  "/api/cron/",
  "/api/chogan-relay",
  "/api/auth/",
  "/api/whatsapp/catalogue", // a sa propre protection (clé ou robot Meta)
];

export const isMachinePath = (pathname: string) => MACHINE_PATHS.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));

/** Lien piège invisible : interdit dans robots.txt, absent pour un humain, suivi par les aspirateurs. */
export const HONEYPOT_PATH = "/catalogue-integral";

export interface Limits {
  perMinute: number;
  perHour: number;
  perDay: number;
}

/**
 * Pages vues autorisées. Large pour un humain (même sur un réseau mobile partagé, la clé combine l'adresse
 * et le navigateur), trop juste pour copier les centaines de pages du site.
 */
export const HUMAN_LIMITS: Limits = { perMinute: 90, perHour: 900, perDay: 3000 };
export const GOOD_BOT_LIMITS: Limits = { perMinute: 240, perHour: 4000, perDay: 20000 };
/** Images et recherches à la volée (/api/search, /api/visuel…), comptées à part. */
export const API_LIMITS: Limits = { perMinute: 120, perHour: 1500, perDay: 6000 };

/**
 * Préchargements et navigations internes de la page (fetch du navigateur) : un ordinateur précharge une trentaine
 * de liens par page vue (mesuré : 194 en 6 pages). Limites très larges, jamais de bannissement sur ce critère.
 */
export const FETCH_LIMITS: Limits = { perMinute: 1500, perHour: 20000, perDay: 60000 };

/**
 * Comment compter une requête :
 * - « page » : un document demandé (clic, adresse tapée… ou un aspirateur, qui n'envoie pas d'en-tête Sec-Fetch) ;
 * - « fetch » : un chargement lancé par la page elle-même (préchargements de liens par Next.js, navigation interne) ;
 *   le navigateur l'annonce avec Sec-Fetch-Dest: empty. Next.js retire ses propres en-têtes avant le proxy,
 *   c'est donc le seul signal fiable ;
 * - null : ne compte pas (formulaires, envois).
 */
export function requestCategory(method: string, headers: Pick<Headers, "get">): "page" | "fetch" | null {
  if (method !== "GET" && method !== "HEAD") return null;
  if (headers.get("next-action")) return null;
  const dest = headers.get("sec-fetch-dest");
  if (dest === "empty" || headers.get("next-router-prefetch") || headers.get("rsc") || headers.get("sec-purpose")?.includes("prefetch") || headers.get("purpose") === "prefetch") return "fetch";
  return "page";
}

/** Compat : une vraie page vue (document). */
export const isCountedRequest = (method: string, headers: Pick<Headers, "get">) => requestCategory(method, headers) === "page";

/** Clé d'un visiteur : adresse + empreinte courte du navigateur (évite de pénaliser tout un réseau mobile partagé). */
export function visitorKey(ip: string, userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  let h = 2166136261;
  for (let i = 0; i < ua.length; i++) {
    h ^= ua.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${ip}|${(h >>> 0).toString(36)}`;
}

/** Fenêtres glissantes simples : nombre de requêtes dans la minute, l'heure et le jour en cours. */
export interface Counter {
  minute: { start: number; n: number };
  hour: { start: number; n: number };
  day: { start: number; n: number };
}

export function newCounter(now: number): Counter {
  return { minute: { start: now, n: 0 }, hour: { start: now, n: 0 }, day: { start: now, n: 0 } };
}

/** Ajoute une requête et dit si une limite est dépassée (et laquelle, pour le message et la durée de blocage). */
export function hit(c: Counter, now: number, limits: Limits): { over: "minute" | "hour" | "day" | null; retryAfterSec: number } {
  const roll = (w: { start: number; n: number }, span: number) => {
    if (now - w.start >= span) {
      w.start = now;
      w.n = 0;
    }
    w.n += 1;
  };
  roll(c.minute, 60_000);
  roll(c.hour, 3_600_000);
  roll(c.day, 86_400_000);
  if (c.day.n > limits.perDay) return { over: "day", retryAfterSec: Math.ceil((c.day.start + 86_400_000 - now) / 1000) };
  if (c.hour.n > limits.perHour) return { over: "hour", retryAfterSec: Math.ceil((c.hour.start + 3_600_000 - now) / 1000) };
  if (c.minute.n > limits.perMinute) return { over: "minute", retryAfterSec: Math.ceil((c.minute.start + 60_000 - now) / 1000) };
  return { over: null, retryAfterSec: 0 };
}

/** Durée de bannissement (secondes) selon la gravité. */
export const BAN_SECONDS = { honeypot: 24 * 3600, day: 24 * 3600, hour: 3600, repeat: 6 * 3600 } as const;
