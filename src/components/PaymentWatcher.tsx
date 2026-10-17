"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Tant que le paiement est en attente, recharge la page toutes les 5 secondes (pendant 3 minutes au plus) :
 * la page vérifie alors le paiement auprès de Versus et affiche la confirmation dès qu'il est reçu.
 */
export function PaymentWatcher({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      if (ticks > 36) return clearInterval(timer);
      router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
