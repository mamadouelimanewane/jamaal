import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { prisma } from "@/lib/prisma";

/** Rappel sur les pages Stocks : réservations payées qui attendent un arrivage. */
export async function ReservationsBanner() {
  const waiting = await prisma.order.count({ where: { isReservation: true, reservationStatus: "RESERVEE" } }).catch(() => 0);
  if (!waiting) return null;
  return (
    <Link href="/admin/reservations" className="mb-4 flex items-center gap-2 rounded-xl border border-[#e3c9bf] bg-[#fbf4f1] px-4 py-3 text-sm text-[#5e3a31] hover:border-[#9c6254]">
      <CalendarClock size={17} className="shrink-0" />
      <span><strong>{waiting} réservation{waiting > 1 ? "s" : ""}</strong> avec acompte attend{waiting > 1 ? "ent" : ""} un arrivage. Après la réception, servez-les depuis « Réservations ».</span>
    </Link>
  );
}
