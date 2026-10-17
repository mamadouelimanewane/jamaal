"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { markReservationsOrdered } from "@/lib/reservation-orders";

export type ReservationOrderedResult = { ok: boolean; message?: string; error?: string };

/**
 * « J'ai passé la commande chez Chogan » : le compteur des réservations à commander repart à zéro.
 * `asOf` est l'instant où l'écran a été affiché : une réservation payée depuis reste dans le compteur.
 */
export async function markReservationsOrderedAction(asOf: string): Promise<ReservationOrderedResult> {
  const session = await requireAdmin();
  const at = new Date(asOf);
  if (Number.isNaN(at.getTime()) || at.getTime() > Date.now() + 60_000) return { ok: false, error: "Date invalide : rechargez la page." };
  const batch = await markReservationsOrdered(at, session.user?.name ?? "Admin");
  if (!batch) return { ok: false, error: "Rien à marquer : le compteur est déjà à zéro." };
  await logActivity(session, `Commande Chogan passée pour les réservations : ${batch.units} article(s), ${batch.lines.length} ligne(s)`, "Reservation");
  revalidatePath("/admin/reservations/a-commander");
  revalidatePath("/admin/reservations");
  revalidatePath("/admin/stocks/commande-chogan");
  return { ok: true, message: `Commande enregistrée : ${batch.units} article(s). Le compteur est remis à zéro.` };
}
