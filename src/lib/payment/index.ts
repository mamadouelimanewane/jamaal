import type { PaymentProvider, PaymentProviderId } from "./types";
import { codProvider } from "./providers/cod";
import { waveProvider } from "./providers/wave";
import { orangeMoneyProvider } from "./providers/orange-money";
import { stripeProvider } from "./providers/stripe";

const all: PaymentProvider[] = [codProvider, waveProvider, orangeMoneyProvider, stripeProvider];

/** Providers proposés au checkout (COD toujours + ceux configurés). */
export function getAvailablePaymentProviders(): PaymentProvider[] {
  return all.filter((p) => p.available);
}

export function getPaymentProvider(id: PaymentProviderId): PaymentProvider | undefined {
  return all.find((p) => p.id === id);
}

export type { PaymentProvider, PaymentProviderId, CreatePaymentInput, CreatePaymentResult } from "./types";
