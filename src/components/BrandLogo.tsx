import Image from "next/image";

/**
 * Logo JAMAAL (monogramme J + nom), recadré : le fichier source est un portrait (720×1080)
 * avec de larges marges blanches. `height` est la hauteur affichée en pixels.
 */
export function BrandLogo({ height = 80, priority = false, className = "" }: { height?: number; priority?: boolean; className?: string }) {
  const width = Math.round((height * 540) / 605);
  return (
    <span className={`relative block shrink-0 overflow-hidden ${className}`} style={{ width, height }}>
      <Image
        src="/logo/jamaal-logo.jpg"
        alt="JAMAAL Luxury Cosmetics"
        width={720}
        height={1080}
        priority={priority}
        sizes={`${Math.ceil(height * 1.3)}px`}
        className="absolute max-w-none"
        style={{ height: "178%", width: "auto", left: "-19.5%", top: "-37%" }}
      />
    </span>
  );
}

/** Même logo en <img> simple, pour les contenus exportés en image (reçu PNG via html-to-image). */
export function BrandLogoPlain({ height = 60 }: { height?: number }) {
  const width = Math.round((height * 540) / 605);
  return (
    <span style={{ position: "relative", display: "block", overflow: "hidden", width, height, flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo/jamaal-logo.jpg"
        alt="JAMAAL Luxury Cosmetics"
        style={{ position: "absolute", maxWidth: "none", height: "178%", width: "auto", left: "-19.5%", top: "-37%" }}
      />
    </span>
  );
}
