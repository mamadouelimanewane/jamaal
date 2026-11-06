import { getT } from "@/lib/i18n/server";
import { schedule, fcfa, type InstallmentOrder } from "@/lib/installments";

/** Échéancier d'une commande payée en plusieurs fois (montant, date, état). */
export async function InstallmentSchedule({ order, className = "" }: { order: InstallmentOrder; className?: string }) {
  const t = await getT();
  const lines = schedule(order);
  if (!lines.length) return null;
  const nextN = lines.find((l) => !l.paid)?.n;
  const now = new Date().getTime();
  return (
    <div className={`rounded-xl border border-line bg-white px-4 py-3 text-left text-sm ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-navy/60">{t("Paiement en")} {order.installmentCount} {t("fois ·")} {order.installmentsPaid}/{order.installmentCount} {t("réglée")}{order.installmentsPaid > 1 ? "s" : ""}</p>
      <ol className="mt-2 divide-y divide-line">
        {lines.map((l) => {
          const late = !l.paid && l.dueAt.getTime() < now - 86_400_000;
          return (
            <li key={l.n} className="flex items-center justify-between gap-3 py-2">
              <span className="text-navy">
                {t("Échéance")} {l.n} · {l.n === 1 ? t("à la commande") : l.dueAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-semibold tabular-nums text-navy">{fcfa(l.amount)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${l.paid ? "bg-emerald-100 text-emerald-900" : late ? "bg-red-100 text-red-900" : l.n === nextN ? "bg-amber-100 text-amber-900" : "bg-cream text-navy/70"}`}>
                  {l.paid ? t("payée") : late ? t("en retard") : l.n === nextN ? t("à payer") : t("à venir")}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
