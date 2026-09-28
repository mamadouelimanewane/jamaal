"use server";

import { getAvailablePaymentProviders } from "@/lib/payment";

export async function listPaymentOptions() {
  return getAvailablePaymentProviders().map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
  }));
}
