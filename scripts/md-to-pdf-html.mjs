/**
 * Convertit un rapport Markdown simple (titres, tableaux, listes, gras, code) en page HTML
 * prête à imprimer en PDF (Edge : msedge --headless --print-to-pdf).
 * Usage : node scripts/md-to-pdf-html.mjs entrée.md sortie.html "Titre du bandeau"
 */
import fs from "node:fs";

const [input, output, banner = ""] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage : node scripts/md-to-pdf-html.mjs entrée.md sortie.html [bandeau]");
  process.exit(1);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

const lines = fs.readFileSync(input, "utf8").replace(/\r\n/g, "\n").split("\n");
const out = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  if (!line.trim()) { i++; continue; }
  const h = line.match(/^(#{1,3}) (.*)$/);
  if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
  if (line.startsWith("|")) {
    const rows = [];
    while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i]); i++; }
    const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const head = cells(rows[0]);
    const body = rows.slice(2).map(cells);
    out.push("<table><thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" +
      body.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table>");
    continue;
  }
  if (/^- /.test(line)) {
    const items = [];
    while (i < lines.length && /^- /.test(lines[i])) { items.push(lines[i].slice(2)); i++; }
    out.push("<ul>" + items.map((t) => `<li>${inline(t)}</li>`).join("") + "</ul>");
    continue;
  }
  if (/^\d+\. /.test(line)) {
    const items = [];
    while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, "")); i++; }
    out.push("<ol>" + items.map((t) => `<li>${inline(t)}</li>`).join("") + "</ol>");
    continue;
  }
  const para = [];
  while (i < lines.length && lines[i].trim() && !/^(#{1,3} |\||- |\d+\. )/.test(lines[i])) { para.push(lines[i]); i++; }
  out.push(`<p>${inline(para.join(" "))}</p>`);
}

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Rapport d'audit JAMAAL (provisoire)</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #182845; font-size: 10.5pt; line-height: 1.5; }
  .banner { background: #182845; color: #fff; padding: 10px 14px; border-radius: 6px; font-weight: 600; letter-spacing: .04em; display: flex; justify-content: space-between; }
  .banner span:last-child { color: #e9c46a; }
  h1 { font-size: 20pt; margin: 18px 0 4px; }
  h2 { font-size: 13.5pt; margin: 20px 0 6px; padding-bottom: 3px; border-bottom: 2px solid #c9a24a; break-after: avoid; }
  p { margin: 6px 0; }
  ul, ol { margin: 6px 0 6px 20px; padding: 0; }
  li { margin: 3px 0; }
  code { background: #f1ece4; padding: 1px 4px; border-radius: 3px; font-size: 9pt; font-family: Consolas, monospace; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9.5pt; break-inside: auto; }
  th { background: #182845; color: #fff; text-align: left; padding: 5px 7px; }
  td { border: 1px solid #ddd3c4; padding: 5px 7px; vertical-align: top; }
  tr { break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #faf6f0; }
  .foot { margin-top: 22px; font-size: 8.5pt; color: #6b7488; border-top: 1px solid #ddd3c4; padding-top: 6px; }
</style></head><body>
<div class="banner"><span>JAMAAL · Rapport d'audit</span><span>${esc(banner)}</span></div>
${out.join("\n")}
<div class="foot">Document provisoire généré à partir de docs/audit-2026-10-14.md. Ce rapport n'est pas une certification délivrée par un organisme tiers.</div>
</body></html>`;
fs.writeFileSync(output, html);
console.log("HTML écrit :", output);
