import Link from "next/link";

export function AnnouncementBar() {
  return <div className="bg-[#241915] px-4 py-2.5 text-center text-[9px] font-medium uppercase tracking-[0.19em] text-white/85 sm:text-[10px]">
    <span className="text-[#d8b894]">JAMAAL</span><span className="mx-2 text-[#d8b894]/65">✦</span> Extraits de parfum concentrés à 30 % <span className="mx-2 hidden text-[#d8b894]/65 sm:inline">·</span><Link href="/quiz" className="ml-1 text-[#d8b894] underline-offset-4 transition hover:underline">Trouver mon sillage</Link>
  </div>;
}