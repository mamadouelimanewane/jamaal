import { prisma } from "./prisma";
import type { Session } from "next-auth";

export async function logActivity(
  session: Session | null,
  action: string,
  entity: string,
  entityId?: string
) {
  await prisma.activityLog.create({
    data: {
      userId: session?.user?.id ?? null,
      userName: session?.user?.name ?? "Système",
      action,
      entity,
      entityId: entityId ?? null,
    },
  });
}
