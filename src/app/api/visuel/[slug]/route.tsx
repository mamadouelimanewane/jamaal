import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { siteBaseUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * Visuel prêt à partager d'un produit (statut WhatsApp, Instagram) : photo, nom, parfum
 * d'inspiration, prix, QR code et coordonnées du revendeur (?ref=identifiant).
 * Formats : story (1080 × 1920, défaut) ou carre (1080 × 1080).
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const square = url.searchParams.get("format") === "carre";
  const ref = (url.searchParams.get("ref") ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
  const origin = siteBaseUrl() || url.origin;

  const product = await prisma.product.findUnique({
    where: { slug },
    select: { name: true, slug: true, photo: true, regularPrice: true, volumes: true, inspiredBy: true, inspiredBrand: true, family: true, colorFrom: true, colorTo: true },
  });
  if (!product) return new Response("Produit introuvable", { status: 404 });
  const reseller = ref ? await prisma.consultant.findFirst({ where: { slug: ref, active: true }, select: { name: true, whatsapp: true, slug: true } }) : null;

  const volumes = ((product.volumes as { label: string; price: number }[] | null) ?? []).filter((v) => v.price > 0);
  const price = volumes.length ? Math.min(...volumes.map((v) => v.price)) : product.regularPrice;
  const link = `${origin}/produits/${product.slug}${reseller?.slug ? `?ref=${reseller.slug}` : ""}`;
  // Les photos passent par l'optimiseur d'images du site (le CDN Chogan refuse les serveurs).
  const photo = product.photo
    ? product.photo.startsWith("/")
      ? `${url.origin}${product.photo}`
      : `${url.origin}/_next/image?url=${encodeURIComponent(product.photo)}&w=828&q=75`
    : null;
  const fcfa = (n: number) => `${n.toLocaleString("fr-FR").replace(/ | /g, " ")} FCFA`;
  const qrSize = square ? 150 : 220;
  const qr = await QRCode.toDataURL(link, { margin: 0, width: qrSize * 2, errorCorrectionLevel: "M", color: { dark: "#14213b", light: "#ffffff" } });
  const W = 1080;
  const H = square ? 1080 : 1920;
  const photoSize = square ? 520 : 860;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", alignItems: "center", background: "linear-gradient(160deg, #14213b 0%, #1d2f4f 60%, #2b3f63 100%)", color: "white", padding: square ? 48 : 80, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: square ? 40 : 56, letterSpacing: 18, color: "#e9c9b9" }}>JAMAAL</div>
        <div style={{ display: "flex", fontSize: square ? 18 : 24, letterSpacing: 6, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>LUXURY COSMETICS</div>
        <div style={{ display: "flex", marginTop: square ? 28 : 56, width: photoSize, height: photoSize, borderRadius: 48, background: "white", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- rendu d'image (next/og)
            <img src={photo} alt="" width={photoSize - 60} height={photoSize - 60} style={{ objectFit: "contain" }} />
          ) : (
            <div style={{ display: "flex", width: photoSize, height: photoSize, background: `linear-gradient(135deg, ${product.colorFrom ?? "#1d2f4f"}, ${product.colorTo ?? "#d9a99d"})` }} />
          )}
        </div>
        <div style={{ display: "flex", textAlign: "center", justifyContent: "center", fontSize: square ? 44 : 64, fontWeight: 700, marginTop: square ? 28 : 56, lineHeight: 1.15, maxWidth: W - 160 }}>{product.name}</div>
        {product.inspiredBy && (
          <div style={{ display: "flex", fontSize: square ? 26 : 36, color: "#e9c9b9", marginTop: 14 }}>
            Inspiré de {product.inspiredBy}{product.inspiredBrand ? ` · ${product.inspiredBrand}` : ""}
          </div>
        )}
        {price ? (
          <div style={{ display: "flex", marginTop: square ? 18 : 36, background: "#0f7a52", borderRadius: 999, padding: square ? "12px 36px" : "18px 54px", fontSize: square ? 40 : 58, fontWeight: 700 }}>
            {volumes.length > 1 ? `dès ${fcfa(price)}` : fcfa(price)}
          </div>
        ) : null}
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 36, background: "rgba(255,255,255,0.08)", borderRadius: 36, padding: square ? 20 : 32, width: "100%" }}>
          <div style={{ display: "flex", background: "white", borderRadius: 20, padding: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendu d'image (next/og) */}
            <img src={qr} alt="" width={qrSize} height={qrSize} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: square ? 30 : 42, fontWeight: 700 }}>{reseller ? `Commandez avec ${reseller.name.split(/\s+/)[0]}` : "Commandez en ligne"}</div>
            {reseller?.whatsapp && <div style={{ display: "flex", fontSize: square ? 26 : 36, color: "#bdebd3", marginTop: 8 }}>WhatsApp : {reseller.whatsapp}</div>}
            <div style={{ display: "flex", fontSize: square ? 20 : 28, color: "rgba(255,255,255,0.75)", marginTop: 8 }}>Scannez le code · livraison à Dakar</div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: { "Cache-Control": "public, max-age=600, s-maxage=3600" } }
  );
}
