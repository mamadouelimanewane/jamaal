import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyAgent, hit, HUMAN_LIMITS, isCountedRequest, isMachinePath, newCounter, requestCategory, visitorKey } from "../bot-guard";

const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const H = (o: Record<string, string> = {}) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

test("anti-aspiration : les vrais navigateurs passent", () => {
  assert.equal(classifyAgent(CHROME_ANDROID), "human");
  assert.equal(classifyAgent(SAFARI_IPHONE), "human");
  assert.equal(classifyAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0"), "human");
  // Navigateurs intégrés (WebView Android, application de bureau)
  assert.equal(classifyAgent("Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36"), "human");
});

test("anti-aspiration : aspirateurs, scripts et robots d'IA refusés", () => {
  for (const ua of [
    "Mozilla/4.5 (compatible; HTTrack 3.0x; Windows 98)",
    "Wget/1.21.4",
    "curl/8.5.0",
    "python-requests/2.32.3",
    "Scrapy/2.11 (+https://scrapy.org)",
    "Go-http-client/2.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0 Safari/537.36",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    "CCBot/2.0 (https://commoncrawl.org/faq/)",
    "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    "SiteSucker/3.2",
    "",
  ]) assert.equal(classifyAgent(ua), "bad", ua);
  assert.equal(classifyAgent(null), "bad");
});

test("anti-aspiration : Google, Bing et les aperçus WhatsApp / Facebook restent autorisés", () => {
  assert.equal(classifyAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), "good");
  assert.equal(classifyAgent("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"), "good");
  assert.equal(classifyAgent("WhatsApp/2.24.21.80 A"), "good");
  assert.equal(classifyAgent("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"), "good");
  assert.equal(classifyAgent("TelegramBot (like TwitterBot)"), "good");
});

test("anti-aspiration : webhooks et tâches techniques jamais filtrés", () => {
  for (const p of ["/api/whatsapp/webhook", "/api/payment/versus/webhook", "/api/cron/daily", "/api/auth/session", "/api/chogan-relay"]) assert.ok(isMachinePath(p), p);
  for (const p of ["/", "/produits/x", "/api/search", "/api/visuel/x"]) assert.ok(!isMachinePath(p), p);
});

test("anti-aspiration : les préchargements de Next.js et les formulaires ne comptent pas", () => {
  assert.ok(isCountedRequest("GET", H()));
  assert.ok(!isCountedRequest("GET", H({ "next-router-prefetch": "1" })));
  assert.ok(!isCountedRequest("GET", H({ "sec-purpose": "prefetch;prerender" })));
  assert.ok(!isCountedRequest("POST", H({ "next-action": "abc" })));
  // Next.js retire ses en-têtes avant le proxy : le navigateur signale ses chargements internes par Sec-Fetch-Dest.
  assert.equal(requestCategory("GET", H({ "sec-fetch-dest": "empty", "sec-fetch-mode": "cors" })), "fetch");
  assert.equal(requestCategory("GET", H({ "sec-fetch-dest": "document", "sec-fetch-mode": "navigate" })), "page");
  // Un aspirateur n'envoie aucun en-tête Sec-Fetch : chaque requête est une page.
  assert.equal(requestCategory("GET", H()), "page");
  assert.equal(requestCategory("POST", H()), null);
});

test("anti-aspiration : un client qui navigue normalement n'est jamais freiné", () => {
  const c = newCounter(0);
  // 25 pages par minute pendant 30 minutes (déjà beaucoup pour un humain) : jamais freiné.
  let t = 0;
  for (let i = 0; i < 25 * 30; i++) {
    t += 2_400;
    assert.equal(hit(c, t, HUMAN_LIMITS).over, null, `page ${i}`);
  }
});

test("anti-aspiration : une rafale est freinée à la minute, une copie lente bannie à l'heure", () => {
  const burst = newCounter(0);
  let r = { over: null as string | null, retryAfterSec: 0 };
  for (let i = 0; i <= HUMAN_LIMITS.perMinute; i++) r = hit(burst, i * 100, HUMAN_LIMITS);
  assert.equal(r.over, "minute");
  assert.ok(r.retryAfterSec > 0 && r.retryAfterSec <= 60);

  const slow = newCounter(0);
  let o: string | null = null;
  for (let i = 0; i <= HUMAN_LIMITS.perHour && !o; i++) o = hit(slow, i * 3_000, HUMAN_LIMITS).over; // 1 page toutes les 3 s
  assert.equal(o, "hour");
});

test("anti-aspiration : la clé distingue deux téléphones derrière la même adresse (réseau mobile partagé)", () => {
  assert.notEqual(visitorKey("41.82.1.1", CHROME_ANDROID), visitorKey("41.82.1.1", SAFARI_IPHONE));
  assert.equal(visitorKey("41.82.1.1", CHROME_ANDROID), visitorKey("41.82.1.1", CHROME_ANDROID));
});
