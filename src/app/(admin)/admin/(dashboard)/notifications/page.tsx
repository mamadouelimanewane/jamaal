import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { Bell } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Notifications</h1>
        {notifications.some((n) => !n.read) && (
          <form action={markAllNotificationsRead}>
            <button className="text-xs font-semibold text-navy hover:underline">
              Tout marquer comme lu
            </button>
          </form>
        )}
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`flex gap-3 rounded-2xl border p-4 ${
              n.read ? "border-line bg-white" : "border-rose bg-rose/10"
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy">
              <Bell size={16} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-navy">{n.title}</p>
              <p className="mt-0.5 text-sm text-navy/70">{n.message}</p>
              <p className="mt-1 text-xs text-navy/40">{n.createdAt.toLocaleString("fr-FR")}</p>
            </div>
            {!n.read && (
              <form action={markNotificationRead.bind(null, n.id)}>
                <button className="text-xs font-semibold text-navy/50 hover:text-navy">Lu</button>
              </form>
            )}
          </li>
        ))}
        {notifications.length === 0 && (
          <p className="text-sm text-navy/50">Aucune notification pour le moment.</p>
        )}
      </ul>
    </div>
  );
}
