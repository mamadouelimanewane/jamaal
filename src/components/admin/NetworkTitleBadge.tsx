import type { NetworkTitle } from "@/lib/network";

const STYLES: Record<NetworkTitle, string> = {
  Leader: "bg-navy text-white",
  Parrain: "bg-[#2f6f9f] text-white",
  Consultant: "bg-[#dbe8f2] text-[#1d4a6b]",
};

/** Titre réseau d'un membre : Leader (sommet), Parrain direct, Consultant (vendeur final). */
export function NetworkTitleBadge({ title }: { title: NetworkTitle }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[title]}`}>{title}</span>;
}
