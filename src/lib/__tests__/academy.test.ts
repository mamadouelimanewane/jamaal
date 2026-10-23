import { test } from "node:test";
import assert from "node:assert/strict";
import { academyProgress, ALL_MODULES, BADGES, badgeLabel, passed, videoEmbed } from "../../data/academy";

test("contenu : chaque module a une leçon et au moins 3 questions valides, identifiants uniques", () => {
  const ids = ALL_MODULES.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of ALL_MODULES) {
    assert.ok(m.lesson.length >= 3, m.id);
    assert.ok(m.questions.length >= 3, m.id);
    for (const q of m.questions) assert.ok(q.answer >= 0 && q.answer < q.choices.length, q.question);
  }
});

test("validation à 80 % et badge obtenu quand tous ses modules sont validés", () => {
  assert.equal(passed({ score: 4, total: 5 }), true);
  assert.equal(passed({ score: 3, total: 5 }), false);
  const parfums = BADGES.find((b) => b.id === "experte-parfums")!;
  const d = new Date("2026-10-20");
  const p = academyProgress(parfums.modules.map((m, i) => ({ quizId: m.id, score: m.questions.length, total: m.questions.length, updatedAt: i === 0 ? d : new Date("2026-10-22") })));
  const exp = p.find((x) => x.badge.id === "experte-parfums")!;
  assert.equal(exp.earned, true);
  assert.equal(exp.earnedAt?.toISOString().slice(0, 10), "2026-10-22");
  assert.equal(p.find((x) => x.badge.id === "conseillere-soins")!.earned, false);
  assert.equal(badgeLabel(parfums, "m"), "Expert parfums");
  assert.equal(badgeLabel(parfums, null), "Experte parfums");
});

test("vidéos : YouTube, Vimeo, fichier ; le reste est refusé", () => {
  assert.deepEqual(videoEmbed("https://youtu.be/dQw4w9WgXcQ"), { kind: "iframe", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0" });
  assert.equal(videoEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
  assert.equal(videoEmbed("https://vimeo.com/123456")?.src, "https://player.vimeo.com/video/123456");
  assert.equal(videoEmbed("https://x.blob.vercel-storage.com/a.mp4")?.kind, "video");
  assert.equal(videoEmbed("javascript:alert(1)"), null);
  assert.equal(videoEmbed("https://evil.example/page"), null);
});
