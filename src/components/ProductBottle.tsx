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
}: {
  colorFrom: string;
  colorTo: string;
  category: string;
  number?: number;
  className?: string;
}) {
  const shape = CATEGORY_SHAPE[category] ?? "perfume";
  const gradId = `grad-${colorFrom.replace("#", "")}-${colorTo.replace("#", "")}`;

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
          <rect x="82" y="30" width="36" height="24" rx="4" fill="#1b2a41" />
          <rect x="92" y="18" width="16" height="16" rx="2" fill="#c9997a" />
          <rect x="60" y="54" width="80" height="150" rx="10" fill={`url(#${gradId})`} stroke="#1b2a41" strokeWidth="2" />
          <rect x="72" y="80" width="56" height="60" rx="4" fill="rgba(255,255,255,0.18)" />
          {number !== undefined && (
            <text x="100" y="150" textAnchor="middle" fontSize="22" fontWeight="700" fill="#fff" fontFamily="serif">
              N°{number}
            </text>
          )}
          <text x="100" y="230" textAnchor="middle" fontSize="13" letterSpacing="2" fill="#1b2a41" fontFamily="serif">
            JAMAAL
          </text>
        </g>
      )}

      {shape === "jar" && (
        <g>
          <rect x="55" y="70" width="90" height="90" rx="14" fill={`url(#${gradId})`} stroke="#1b2a41" strokeWidth="2" />
          <rect x="60" y="50" width="80" height="26" rx="8" fill="#1b2a41" />
          <ellipse cx="100" cy="50" rx="40" ry="8" fill="#c9997a" />
          <text x="100" y="120" textAnchor="middle" fontSize="12" letterSpacing="1.5" fill="#fff" fontFamily="serif">
            AURODHEA
          </text>
        </g>
      )}

      {shape === "bottle" && (
        <g>
          <rect x="85" y="40" width="30" height="30" fill="#1b2a41" rx="4" />
          <path
            d="M75 70 h50 l10 20 v110 a8 8 0 0 1 -8 8 h-54 a8 8 0 0 1 -8 -8 v-110 z"
            fill={`url(#${gradId})`}
            stroke="#1b2a41"
            strokeWidth="2"
          />
          <text x="100" y="170" textAnchor="middle" fontSize="11" letterSpacing="1.5" fill="#fff" fontFamily="serif">
            JAMAAL
          </text>
        </g>
      )}

      {shape === "tube" && (
        <g>
          <rect x="70" y="40" width="60" height="150" rx="20" fill={`url(#${gradId})`} stroke="#1b2a41" strokeWidth="2" />
          <rect x="80" y="30" width="40" height="20" rx="6" fill="#1b2a41" />
          <circle cx="100" cy="120" r="18" fill="rgba(255,255,255,0.2)" />
        </g>
      )}

      {shape === "candle" && (
        <g>
          <rect x="65" y="90" width="70" height="90" rx="6" fill={`url(#${gradId})`} stroke="#1b2a41" strokeWidth="2" />
          <rect x="97" y="60" width="6" height="32" fill="#1b2a41" />
          <path d="M100 40 q8 12 0 20 q-8 -8 0 -20 z" fill="#c9997a" />
        </g>
      )}

      {shape === "jewel" && (
        <g>
          <circle cx="100" cy="120" r="55" fill="none" stroke={colorFrom} strokeWidth="6" />
          <path d="M100 70 l16 30 l-16 30 l-16 -30 z" fill={`url(#${gradId})`} stroke="#1b2a41" strokeWidth="2" />
        </g>
      )}

      {shape === "box" && (
        <g>
          <rect x="55" y="80" width="90" height="90" rx="6" fill={`url(#${gradId})`} stroke="#1b2a41" strokeWidth="2" />
          <rect x="55" y="80" width="90" height="24" fill="rgba(0,0,0,0.15)" />
          <rect x="95" y="80" width="10" height="90" fill="rgba(255,255,255,0.3)" />
        </g>
      )}
    </svg>
  );
}
