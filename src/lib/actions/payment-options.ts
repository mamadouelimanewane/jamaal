"use server";

import { getAvailablePaymentProviders } from "@/lib/payment";
import { getBusinessModel } from "@/lib/business-model-store";

export async function listPaymentOptions() {
  return getAvailablePaymentProviders(await getBusinessModel()).map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
  }));
}
