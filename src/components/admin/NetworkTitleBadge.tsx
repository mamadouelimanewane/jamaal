import type { NetworkTitle } from "@/lib/network";

const STYLES: Record<NetworkTitle, string> = {
  Consultant: "bg-navy text-white",
  Leader: "bg-[#2f6f9f] text-white",
  Parrain: "bg-[#dbe8f2] text-[#1d4a6b]",
};

/** Titre réseau d'un membre : Consultant (sommet), Leader, Parrain. */
export function NetworkTitleBadge({ title }: { title: NetworkTitle }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[title]}`}>{title}</span>;
}
