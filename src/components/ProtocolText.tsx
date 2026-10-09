import { protocolBlocks } from "@/lib/protocol";

/** Affichage lisible du protocole (titres, paragraphes, listes). */
export function ProtocolText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-2.5 text-[13.5px] leading-relaxed text-navy/85 ${className}`}>
      {protocolBlocks(text).map((b, i) =>
        b.kind === "h" ? (
          <h3 key={i} className="pt-2 font-semibold text-navy">{b.text}</h3>
        ) : b.kind === "li" ? (
          <p key={i} className="pl-4 -indent-3">• {b.text}</p>
        ) : b.kind === "ol" ? (
          <p key={i} className="pl-5 -indent-4">{b.n}. {b.text}</p>
        ) : (
          <p key={i}>{b.text}</p>
        )
      )}
    </div>
  );
}
