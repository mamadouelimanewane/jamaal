const CATEGORY_SHAPE: Record<string, "perfume" | "jar" | "bottle" | "tube" | "box" | "candle" | "jewel"> = {
  "parfum-femme": "perfume",
  "parfum-homme": "perfume",
  aurodhea: "jar",
  lolum: "bottle",
  maquillage: "tube",
  bijoux: "jewel",
  "entretien-maison": "bottle",
  "complement-alimentaire": "bottle",
  "parfum-ambiance": "candle",
  "autres-produits": "box",
};

export function ProductBottle({
  colorFrom,
  colorTo,
  category,
  number,
  className,
  id,
}: {
  colorFrom: string;
  colorTo: string;
  category: string;
  number?: number;
  className?: string;
  id?: string;
}) {
  const shape = CATEGORY_SHAPE[category] ?? "perfume";
  const safeId = (id || `${category}-${number ?? "item"}-${colorFrom}-${colorTo}`).replace(/[^a-zA-Z0-9_-]/g, "");
  const gradId = `grad-${safeId}`;

  return (
    <svg
      viewBox="0 0 200 260"
      className={className}
      role="img"
      aria-label={number ? `Flacon JAMAAL n°${number}` : "Produit JAMAAL"}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colorFrom} />
          <stop offset="100%" stopColor={colorTo} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="200" height="260" fill="#faf6f1" rx="12" />

      {shape === "perfume" && (
        <g>
          <ellipse cx="100" cy="224" rx="62" ry="12" fill="#14213b" opacity=".13" />
          <rect x="78" y="67" width="44" height="30" rx="3" fill="#ae8c61" />
          <rect x="72" y="48" width="56" height="22" rx="3" fill="#d5bd8f" />
          <path d="M81 48v-8c0-4 3-7 7-7h24c4 0 7 3 7 7v8" fill="#9e7a4f" />
          <path d="M65 100c0-8 7-14 15-14h40c8 0 15 6 15 14v92c0 10-8 18-18 18H83c-10 0-18-8-18-18z" fill={`url(#${gradId})`} stroke="#ac8e68" strokeWidth="2" />
          <path d="M73 111c0-6 4-9 9-9h5v91c0 5 1 9 3 13h-7c-6 0-10-5-10-11z" fill="#fff" opacity=".3" />
          <path d="M127 109v83c0 5-2 9-5 12" fill="none" stroke="#fff" strokeWidth="3" opacity=".38" />
          <rect x="77" y="126" width="46" height="50" rx="1" fill="#f7f1e6" stroke="#d6c5ad" />
          <text x="100" y="145" textAnchor="middle" fontSize="6" letterSpacing="1.5" fill="#9c6254" fontFamily="serif">EXTRAIT</text>
          {number !== undefined && <text x="100" y="162" textAnchor="middle" fontSize="12" fontWeight="600" fill="#14213b" fontFamily="serif">N°{number}</text>}
          <text x="100" y="171" textAnchor="middle" fontSize="5" letterSpacing="1.4" fill="#14213b" fontFamily="serif">JAMAAL</text>
          <path d="M86 211h28" stroke="#c4a579" strokeWidth="1" />
        </g>
      )}
      {shape === "jar" && (
        <g>
          <rect x="55" y="70" width="90" height="90" rx="14" fill={`url(#${gradId})`} stroke="#1d2f4f" strokeWidth="2" />
          <rect x="60" y="50" width="80" height="26" rx="8" fill="#1d2f4f" />
          <ellipse cx="100" cy="50" rx="40" ry="8" fill="#d9a99d" />
          <text x="100" y="120" textAnchor="middle" fontSize="12" letterSpacing="1.5" fill="#fff" fontFamily="serif">
            AURODHEA
          </text>
        </g>
      )}

      {shape === "bottle" && (
        <g>
          <rect x="85" y="40" width="30" height="30" fill="#1d2f4f" rx="4" />
          <path
            d="M75 70 h50 l10 20 v110 a8 8 0 0 1 -8 8 h-54 a8 8 0 0 1 -8 -8 v-110 z"
            fill={`url(#${gradId})`}
            stroke="#1d2f4f"
            strokeWidth="2"
          />
          <text x="100" y="170" textAnchor="middle" fontSize="11" letterSpacing="1.5" fill="#fff" fontFamily="serif">
            JAMAAL
          </text>
        </g>
      )}

      {shape === "tube" && (
        <g>
          <rect x="70" y="40" width="60" height="150" rx="20" fill={`url(#${gradId})`} stroke="#1d2f4f" strokeWidth="2" />
          <rect x="80" y="30" width="40" height="20" rx="6" fill="#1d2f4f" />
          <circle cx="100" cy="120" r="18" fill="rgba(255,255,255,0.2)" />
        </g>
      )}

      {shape === "candle" && (
        <g>
          <rect x="65" y="90" width="70" height="90" rx="6" fill={`url(#${gradId})`} stroke="#1d2f4f" strokeWidth="2" />
          <rect x="97" y="60" width="6" height="32" fill="#1d2f4f" />
          <path d="M100 40 q8 12 0 20 q-8 -8 0 -20 z" fill="#d9a99d" />
        </g>
      )}

      {shape === "jewel" && (
        <g>
          <circle cx="100" cy="120" r="55" fill="none" stroke={colorFrom} strokeWidth="6" />
          <path d="M100 70 l16 30 l-16 30 l-16 -30 z" fill={`url(#${gradId})`} stroke="#1d2f4f" strokeWidth="2" />
        </g>
      )}

      {shape === "box" && (
        <g>
          <rect x="55" y="80" width="90" height="90" rx="6" fill={`url(#${gradId})`} stroke="#1d2f4f" strokeWidth="2" />
          <rect x="55" y="80" width="90" height="24" fill="rgba(0,0,0,0.15)" />
          <rect x="95" y="80" width="10" height="90" fill="rgba(255,255,255,0.3)" />
        </g>
      )}
    </svg>
  );
}
