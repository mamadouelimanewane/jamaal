import { Check } from "lucide-react";
import type { OrderStatus } from "@prisma/client";

const steps: { key: OrderStatus; label: string }[] = [
  { key: "EN_ATTENTE", label: "Commande reçue" },
  { key: "CONFIRMEE", label: "Confirmée" },
  { key: "EXPEDIEE", label: "En route" },
  { key: "LIVREE", label: "Livrée" },
];

export function DeliveryTimeline({ status }: { status: OrderStatus }) {
  if (status === "ANNULEE") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        Cette commande a été annulée.
      </div>
    );
  }

  const currentIndex = steps.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const done = i <= currentIndex;
        const isLast = i === steps.length - 1;
        return (
          <div key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                  done ? "bg-navy text-white" : "bg-cream text-navy/40"
                }`}
              >
                {done ? <Check size={14} /> : i + 1}
              </div>
              <span className={`mt-2 max-w-[80px] text-center text-[11px] ${done ? "text-navy" : "text-navy/40"}`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`mx-1 h-0.5 flex-1 ${i < currentIndex ? "bg-navy" : "bg-cream"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
