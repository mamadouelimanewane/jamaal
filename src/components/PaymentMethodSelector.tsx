"use client";

import { useT } from "@/components/i18n/LocaleProvider";
import type { PaymentProviderId } from "@/lib/payment/types";

export interface PaymentOption {
  id: PaymentProviderId;
  label: string;
  description: string;
}

export function PaymentMethodSelector({
  options,
  value,
  onChange,
}: {
  options: PaymentOption[];
  value: PaymentProviderId;
  onChange: (id: PaymentProviderId) => void;
}) {
  const t = useT();
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-navy/50">
        {t("Mode de paiement")}
      </legend>
      {options.map((opt) => (
        <label
          key={opt.id}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
            value === opt.id ? "border-navy bg-navy/5" : "border-line bg-white hover:border-navy/40"
          }`}
        >
          <input
            type="radio"
            name="paymentMethod"
            value={opt.id}
            checked={value === opt.id}
            onChange={() => onChange(opt.id)}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold text-navy">{t(opt.label)}</span>
            <span className="block text-xs text-navy/50">{t(opt.description)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
