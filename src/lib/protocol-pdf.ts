/**
 * Exemplaire PDF du protocole signé : texte de la version signée, identité, signature dessinée,
 * date, adresse IP et empreinte du texte. Fichier serveur.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { protocolBlocks } from "./protocol";

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
/** Les polices standard du PDF ne couvrent que le jeu WinAnsi : on remplace le reste. */
const safe = (s: string) =>
  [...s.replace(/ | /g, " ").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/→/g, "->")]
    .map((c) => (c.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.includes(c) ? c : "?"))
    .join("");

export interface SignedProtocol {
  version: number;
  text: string;
  textHash: string;
  signerName: string;
  piece: string;
  address: string | null;
  phone: string | null;
  image: Uint8Array;
  ip: string | null;
  signedAt: Date;
  approvedAt?: Date | null;
}

export async function protocolPdf(p: SignedProtocol): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Protocole de partenariat JAMAAL — ${p.signerName}`);
  doc.setAuthor("JAMAAL Luxury Cosmetics");
  doc.setCreationDate(p.signedAt);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 56, LW = W - 2 * M;
  const navy = rgb(0.11, 0.18, 0.31), grey = rgb(0.35, 0.38, 0.45);
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const lines = (text: string, f: PDFFont, size: number, width: number) => {
    const out: string[] = [];
    for (const para of safe(text).split("\n")) {
      let cur = "";
      for (const word of para.split(/\s+/)) {
        const t = cur ? `${cur} ${word}` : word;
        if (f.widthOfTextAtSize(t, size) <= width) cur = t;
        else {
          if (cur) out.push(cur);
          cur = word;
        }
      }
      out.push(cur);
    }
    return out;
  };
  const write = (text: string, o: { f?: PDFFont; size?: number; indent?: number; color?: ReturnType<typeof rgb>; gap?: number; prefix?: string } = {}) => {
    const f = o.f ?? font, size = o.size ?? 10, indent = o.indent ?? 0, lh = size * 1.42;
    const ls = lines(text, f, size, LW - indent);
    ls.forEach((l, i) => {
      if (y - lh < M) newPage();
      y -= lh;
      if (i === 0 && o.prefix) page.drawText(safe(o.prefix), { x: M + indent - 12, y, size, font: f, color: o.color ?? navy });
      page.drawText(l, { x: M + indent, y, size, font: f, color: o.color ?? navy });
    });
    y -= o.gap ?? 4;
  };

  write("JAMAAL Luxury Cosmetics", { f: bold, size: 9, color: grey, gap: 2 });
  write("Protocole de partenariat", { f: bold, size: 20, gap: 4 });
  write(`Version ${p.version} · signée électroniquement par ${p.signerName} le ${p.signedAt.toLocaleString("fr-FR", { timeZone: "Africa/Dakar" })} (heure de Dakar)`, { size: 9, color: grey, gap: 14 });

  for (const b of protocolBlocks(p.text)) {
    if (b.kind === "h") {
      y -= 6;
      write(b.text, { f: bold, size: 11.5, gap: 3 });
    } else if (b.kind === "li") write(b.text, { indent: 14, prefix: "•", gap: 3 });
    else if (b.kind === "ol") write(b.text, { indent: 16, prefix: `${b.n}.`, gap: 3 });
    else write(b.text, { gap: 6 });
  }

  // Bloc de signature
  if (y < M + 200) newPage();
  y -= 14;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: grey });
  y -= 4;
  write("Signature", { f: bold, size: 12, gap: 6 });
  write(`Le Partenaire : ${p.signerName}${p.piece ? `, ${p.piece}` : ""}`, { gap: 2 });
  if (p.address) write(`Adresse : ${p.address}`, { gap: 2 });
  if (p.phone) write(`Téléphone : ${p.phone}`, { gap: 2 });
  write("Mention : « Lu et approuvé »", { gap: 8 });
  try {
    const png = await doc.embedPng(p.image);
    const scale = Math.min(220 / png.width, 90 / png.height, 1);
    const w = png.width * scale, h = png.height * scale;
    if (y - h < M) newPage();
    page.drawImage(png, { x: M, y: y - h, width: w, height: h });
    y -= h + 10;
  } catch {
    write("[signature illisible]", { color: grey });
  }
  write(`Pour JAMAAL : adhésion ${p.approvedAt ? `validée le ${p.approvedAt.toLocaleDateString("fr-FR")}` : "en cours de validation"}.`, { gap: 10 });
  write(`Preuve de signature : adresse IP ${p.ip ?? "inconnue"} · empreinte SHA-256 du texte signé ${p.textHash}`, { size: 7.5, color: grey });

  const pages = doc.getPages();
  pages.forEach((pg, i) => pg.drawText(safe(`Protocole de partenariat JAMAAL · v${p.version} · ${p.signerName} · page ${i + 1}/${pages.length}`), { x: M, y: 28, size: 7.5, font, color: grey }));
  return doc.save();
}
