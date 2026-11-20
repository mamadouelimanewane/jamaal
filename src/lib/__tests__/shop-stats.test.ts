import { test } from "node:test";
import assert from "node:assert/strict";
import { countVisitors, dailySeries, parsePeriod, periodStart, rate, topProducts, trend, isShopEventKind } from "../shop/shop-stats";

const now = new Date("2026-10-28T15:00:00Z");
const ev = (kind: string, at: string, sid: string | null = null, productId: string | null = null) => ({ kind, sid, productId, createdAt: new Date(at) });

test("statistiques boutique : période, début de période, types", () => {
  assert.equal(parsePeriod("7"), 7);
  assert.equal(parsePeriod("90"), 90);
  assert.equal(parsePeriod("12"), 30);
  assert.equal(parsePeriod(undefined), 30);
  assert.equal(periodStart(7, now).toISOString(), "2026-10-22T00:00:00.000Z");
  assert.equal(isShopEventKind("whatsapp"), true);
  assert.equal(isShopEventKind("autre"), false);
});

test("statistiques boutique : visiteurs distincts, série par jour, produits les plus cliqués", () => {
  const list = [
    ev("visite", "2026-10-28T10:00:00Z", "a"),
    ev("visite", "2026-10-28T11:00:00Z", "a"),
    ev("visite", "2026-10-28T11:30:00Z", "b"),
    ev("visite", "2026-10-27T09:00:00Z", null),
    ev("whatsapp", "2026-10-28T10:01:00Z", "a"),
    ev("produit", "2026-10-28T10:02:00Z", "a", "p1"),
    ev("produit", "2026-10-27T10:02:00Z", "c", "p2"),
    ev("produit", "2026-10-26T10:02:00Z", "d", "p2"),
  ];
  assert.equal(countVisitors(list), 3);
  const s = dailySeries(list, 3, now);
  assert.deepEqual(s.map((d) => d.day), ["2026-10-26", "2026-10-27", "2026-10-28"]);
  assert.deepEqual(s[2], { day: "2026-10-28", visitors: 2, whatsapp: 1, products: 1 });
  assert.equal(s[1].visitors, 1);
  assert.deepEqual(topProducts(list), [["p2", 2], ["p1", 1]]);
});

test("statistiques boutique : taux et évolution", () => {
  assert.equal(rate(1, 3), 33.3);
  assert.equal(rate(5, 0), 0);
  assert.equal(trend(15, 10), 50);
  assert.equal(trend(5, 10), -50);
  assert.equal(trend(5, 0), null);
});

import { detectSource } from "../shop/shop-stats";
import { classifyAgent } from "../bot-guard";

const FB_UA = "Mozilla/5.0 (Linux; Android 13; SM-A135F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0.0.30.110;]";
const IG_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 307.0.0.34.111 (iPhone14,5; iOS 17_1; fr_FR)";
const TT_UA = "Mozilla/5.0 (Linux; Android 12; TECNO) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110 Mobile Safari/537.36 trill_310503 BytedanceWebview/d8a21c6 musical_ly_2023";
const CHROME = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36";

test("detectSource : lien JAMAAL, identifiant de clic, navigateur intégré, site d'origine", () => {
  assert.equal(detectSource({ search: "?utm_source=whatsapp", userAgent: FB_UA }), "whatsapp");
  assert.equal(detectSource({ search: "?fbclid=IwAR0abc", userAgent: CHROME }), "facebook");
  assert.equal(detectSource({ search: "", userAgent: FB_UA }), "facebook");
  assert.equal(detectSource({ search: "", userAgent: IG_UA }), "instagram");
  assert.equal(detectSource({ search: "?fbclid=x", userAgent: IG_UA }), "instagram");
  assert.equal(detectSource({ search: "", userAgent: TT_UA }), "tiktok");
  assert.equal(detectSource({ referrer: "https://l.facebook.com/", userAgent: CHROME }), "facebook");
  assert.equal(detectSource({ referrer: "https://www.google.com/", userAgent: CHROME }), "google");
  assert.equal(detectSource({ referrer: "https://blog.exemple.sn/x", userAgent: CHROME }), "autre");
  assert.equal(detectSource({ referrer: "https://www.jamaal.sn/parfums", host: "www.jamaal.sn", userAgent: CHROME }), "direct");
  assert.equal(detectSource({ userAgent: CHROME }), "direct");
});

test("les navigateurs intégrés de Facebook, Instagram et TikTok comptent comme des visiteurs", () => {
  for (const ua of [FB_UA, IG_UA, TT_UA]) assert.equal(classifyAgent(ua), "human");
});
