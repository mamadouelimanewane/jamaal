import { test } from "node:test";
import assert from "node:assert/strict";
import { ago, distanceM, isFresh, orderStops, parseFix, shouldSend, simplifyTrail } from "../geo-track";
import { estimatedRoute, parseOsrm } from "../routing";

const PLATEAU = { lat: 14.6708, lng: -17.4381 };
const step = (m: number) => ({ lat: PLATEAU.lat + m / 111_320, lng: PLATEAU.lng });

test("envoi des positions : cadence et distance", () => {
  const t0 = 1_000_000;
  assert.equal(shouldSend(null, { ...PLATEAU, at: t0 }), true);
  const last = { ...PLATEAU, at: t0 };
  assert.equal(shouldSend(last, { ...step(100), at: t0 + 3_000 }), false, "jamais avant 5 s");
  assert.equal(shouldSend(last, { ...step(30), at: t0 + 9_000 }), true, "30 m après 9 s");
  assert.equal(shouldSend(last, { ...step(5), at: t0 + 20_000 }), false, "immobile");
  assert.equal(shouldSend(last, { ...step(5), at: t0 + 46_000 }), true, "signal de présence");
});

test("distance, fraîcheur, durée écoulée", () => {
  assert.ok(Math.abs(distanceM(PLATEAU, step(250)) - 250) <= 1);
  const now = new Date("2026-10-29T12:00:00Z");
  assert.equal(isFresh(new Date("2026-10-29T11:55:00Z"), now), true);
  assert.equal(isFresh(new Date("2026-10-29T11:45:00Z"), now), false);
  assert.equal(isFresh(null, now), false);
  assert.equal(ago(new Date("2026-10-29T11:59:30Z"), now), "il y a 30 s");
  assert.equal(ago(new Date("2026-10-29T11:56:00Z"), now), "il y a 4 min");
});

test("trace allégée et ordre de passage au plus proche", () => {
  const pts = [0, 3, 6, 20, 22, 40, 41].map(step);
  const t = simplifyTrail(pts, 15);
  assert.equal(t.length, 4);
  assert.deepEqual(simplifyTrail(Array.from({ length: 50 }, (_, i) => step(i * 20)), 15, 10).length, 10);
  const stops = [{ id: "loin", ...step(5000) }, { id: "pres", ...step(500) }, { id: "milieu", ...step(2000) }];
  assert.deepEqual(orderStops(PLATEAU, stops).map((s) => s.id), ["pres", "milieu", "loin"]);
});

test("position reçue : contrôles", () => {
  assert.equal(parseFix({ lat: "14", lng: -17 }), null);
  assert.equal(parseFix({ lat: 0, lng: 0 }), null);
  assert.equal(parseFix({ lat: 95, lng: 0 }), null);
  assert.deepEqual(parseFix({ lat: 14.7, lng: -17.4, accuracy: 12, speed: 200, heading: 90 }), { lat: 14.7, lng: -17.4, accuracy: 12, speed: null, heading: 90 });
});

test("itinéraire OSRM et repli", () => {
  const r = parseOsrm({ code: "Ok", routes: [{ distance: 5400, duration: 720, geometry: { coordinates: [[-17.44, 14.67], [-17.45, 14.69]] }, legs: [{ distance: 5400, duration: 720 }] }] });
  assert.ok(r);
  assert.deepEqual(r!.path[0], [14.67, -17.44]);
  assert.equal(r!.km, 5.4);
  assert.equal(r!.minutes, 15);
  assert.equal(parseOsrm({ code: "NoRoute" }), null);
  const e = estimatedRoute([PLATEAU, step(2000), step(4000)]);
  assert.equal(e.legs.length, 2);
  assert.equal(e.source, "estimation");
  assert.ok(e.km > 5 && e.km < 6);
});
