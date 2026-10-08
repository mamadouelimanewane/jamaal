const styles: Record<string, string> = {
  NONE: "bg-navy/10 text-navy/85",
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-rose-100 text-rose-800",
  REFUNDED: "bg-slate-100 text-slate-700",
};

const labels: Record<string, string> = {
  NONE: "À la livraison",
  PENDING: "En attente",
  PAID: "Payé",
  FAILED: "Échec",
  REFUNDED: "Remboursé",
};

const methodShort: Record<string, string> = {
  COD: "COD",
  WAVE: "Wave",
  ORANGE_MONEY: "OM",
  STRIPE: "Carte",
};

export function PaymentStatusBadge({
  status,
  method,
}: {
  status?: string | null;
  method?: string | null;
}) {
  const s = status || "NONE";
  const m = method || "COD";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${styles[s] || styles.NONE}`}
    >
      {methodShort[m] || m}
      {s !== "NONE" && <> · {labels[s] || s}</>}
      {s === "NONE" && m === "COD" && <> · {labels.NONE}</>}
    </span>
  );
}
