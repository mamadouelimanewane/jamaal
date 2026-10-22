/**
 * Illustration originale du Skin Advisor (en attendant des photos) : trois femmes africaines aux peaux
 * foncées, style éditorial épuré, sur fond sable. Aucun visuel de marque.
 */
export function SkinIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 500" role="img" aria-label="Trois femmes africaines à la peau éclatante" className={className}>
      <defs>
        <linearGradient id="si-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#efe2d6" />
          <stop offset="1" stopColor="#d9bfa8" />
        </linearGradient>
        <linearGradient id="si-light" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="si-glow1" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#7a4a33" />
          <stop offset="1" stopColor="#4a2a1c" />
        </radialGradient>
        <radialGradient id="si-glow2" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#5c3424" />
          <stop offset="1" stopColor="#331c12" />
        </radialGradient>
        <radialGradient id="si-glow3" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#8d5a3e" />
          <stop offset="1" stopColor="#5a3524" />
        </radialGradient>
      </defs>
      <rect width="400" height="500" fill="url(#si-bg)" />
      <polygon points="0,90 400,10 400,120 0,230" fill="url(#si-light)" />

      {/* Femme de gauche : cheveux naturels */}
      <g>
        <circle cx="95" cy="200" r="58" fill="#1d120c" />
        <ellipse cx="98" cy="222" rx="38" ry="46" fill="url(#si-glow1)" />
        <path d="M60 330 q38 -50 76 0 l18 170 h-112 z" fill="#c9a98f" />
        <rect x="86" y="262" width="22" height="34" rx="9" fill="url(#si-glow1)" />
        <ellipse cx="86" cy="214" rx="9" ry="5" fill="#fff" fillOpacity="0.12" />
      </g>

      {/* Femme du centre : foulard */}
      <g>
        <path d="M150 175 q50 -95 100 0 q8 30 -6 48 h-88 q-14 -18 -6 -48z" fill="#9b5c4d" />
        <path d="M160 160 q40 -40 80 0" stroke="#b97a63" strokeWidth="8" fill="none" strokeLinecap="round" />
        <ellipse cx="200" cy="235" rx="40" ry="50" fill="url(#si-glow2)" />
        <path d="M150 350 q50 -55 100 0 l22 150 h-144 z" fill="#5f6b4e" />
        <rect x="188" y="280" width="24" height="38" rx="10" fill="url(#si-glow2)" />
        <ellipse cx="186" cy="228" rx="10" ry="6" fill="#fff" fillOpacity="0.12" />
        {/* pot de crème sans marque */}
        <rect x="224" y="352" width="44" height="30" rx="7" fill="#f6efe8" />
        <rect x="224" y="346" width="44" height="10" rx="4" fill="#e6d8cb" />
        <path d="M262 400 q-8 -30 -2 -48" stroke="url(#si-glow2)" strokeWidth="16" strokeLinecap="round" fill="none" />
      </g>

      {/* Femme de droite : tresses */}
      <g>
        <path d="M262 190 q44 -86 88 0 v120 h-12 v-100 h-64 v100 h-12z" fill="#1d120c" />
        <ellipse cx="306" cy="226" rx="36" ry="45" fill="url(#si-glow3)" />
        <path d="M268 340 q38 -48 76 0 l16 160 h-108 z" fill="#d8c7b4" />
        <rect x="295" y="266" width="22" height="34" rx="9" fill="url(#si-glow3)" />
        <ellipse cx="294" cy="218" rx="9" ry="5" fill="#fff" fillOpacity="0.14" />
        {/* flacon de sérum sans marque */}
        <rect x="330" y="356" width="18" height="44" rx="5" fill="#2f4a6b" />
        <rect x="334" y="344" width="10" height="14" rx="3" fill="#e9eef4" />
      </g>
    </svg>
  );
}
