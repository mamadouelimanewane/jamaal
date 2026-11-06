import { getT } from "@/lib/i18n/server";
import Link from "@/components/i18n/Link";

export async function AnnouncementBar() {
  const t = await getT();
  return <div className="bg-[#14213b] px-4 py-2.5 text-center text-[9px] font-medium uppercase tracking-[0.19em] text-white/85 sm:text-[10px]">
    <span className="text-[#d9a99d]">JAMAAL</span><span className="mx-2 text-[#d9a99d]/65">✦</span> {t("Extraits de parfum concentrés à 30 %")} <span className="mx-2 hidden text-[#d9a99d]/65 sm:inline">·</span><Link href="/parfum-adn" className="ml-1 text-[#d9a99d] underline-offset-4 transition hover:underline">{t("Trouver mon sillage")}</Link>
  </div>;
}