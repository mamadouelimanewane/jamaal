import { test } from "node:test";
import assert from "node:assert/strict";
import { baseline, eventForWeek, forecastLine, learnUplifts, seasonEvents, upcomingEvents, weekStart, WEEK, type WeeklySales } from "../forecast/forecast";

const steady = (now: Date, perWeek: number, weeks = 60): WeeklySales => {
  const m: WeeklySales = new Map();
  const start = weekStart(now).getTime();
  for (let i = 1; i <= weeks; i++) m.set(start - i * WEEK, perWeek);
  return m;
};

test("calendrier : Tabaski et Korité 2026, fête des mères, semaine de lundi", () => {
  const ev = seasonEvents(2026);
  assert.equal(ev.find((e) => e.label === "Tabaski")!.date.toISOString().slice(0, 10), "2026-05-27");
  assert.equal(ev.find((e) => e.label === "Korité")!.date.toISOString().slice(0, 10), "2026-03-20");
  assert.equal(ev.find((e) => e.label === "Fête des mères")!.date.toISOString().slice(0, 10), "2026-05-31");
  assert.equal(weekStart(new Date("2026-10-23T15:00:00Z")).toISOString().slice(0, 10), "2026-10-19");
  assert.equal(eventForWeek(new Date("2026-05-18T00:00:00Z"), ev)?.label, "Tabaski");
  assert.equal(eventForWeek(new Date("2026-07-06T00:00:00Z"), ev), null);
});

test("hors fête : commande = délai + couverture + sécurité − stock", () => {
  const now = new Date("2026-07-15T10:00:00Z");
  const f = forecastLine(steady(now, 4), 10, 0, now, { leadWeeks: 3, coverWeeks: 4 });
  assert.equal(f.weekly, 4);
  assert.equal(f.demand, 28);
  assert.equal(f.order, 28 + 4 - 10);
  assert.equal(f.event, null);
  assert.equal(f.weeksOfStock, 2.5);
});

test("avant Tabaski : la demande monte et la fête est signalée ; réservations ajoutées", () => {
  const now = new Date("2026-04-27T10:00:00Z");
  const f = forecastLine(steady(now, 4), 0, 2, now, { leadWeeks: 3, coverWeeks: 4 });
  assert.equal(f.event?.label, "Tabaski");
  assert.ok(f.demand > 28, String(f.demand));
  assert.ok(f.order >= Math.ceil(f.demand) + 4 + 2 - 1);
  const learned = forecastLine(steady(now, 4), 0, 0, now, { leadWeeks: 3, coverWeeks: 4, uplifts: { tabaski: 3 } });
  assert.equal(learned.event?.uplift, 3);
});

test("stock dormant et produit qui ne se vend plus", () => {
  const now = new Date("2026-07-15T10:00:00Z");
  assert.equal(forecastLine(steady(now, 1), 30, 0, now, { leadWeeks: 3, coverWeeks: 4 }).dormant, 14);
  const dead = forecastLine(new Map(), 12, 0, now, { leadWeeks: 3, coverWeeks: 4 });
  assert.equal(dead.order, 0);
  assert.equal(dead.dormant, 12);
});

test("effet des fêtes appris sur l'historique", () => {
  const now = new Date("2026-10-23T10:00:00Z");
  const totals = steady(now, 10, 80);
  // Tabaski 2026 (27 mai) : semaines de fête à 25 ventes au lieu de 10
  for (const [w] of totals) if (eventForWeek(new Date(w), [...seasonEvents(2025), ...seasonEvents(2026)].filter((e) => e.label === "Tabaski"))) totals.set(w, 25);
  const u = learnUplifts(totals, now);
  assert.equal(u.tabaski, 2.5);
  assert.equal(baseline(totals, now, seasonEvents(2026)), 10);
  assert.ok(upcomingEvents(now).some((e) => e.label === "Fêtes de fin d'année"));
});
