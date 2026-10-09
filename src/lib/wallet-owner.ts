import { auth } from "./auth";
import { prisma } from "./prisma";
import { getReseller } from "./reseller";
import type { Owner } from "./wallet";

/** Wallet de la personne connectée (revendeur, livreur, ou admin en « vue consultant »). */
export async function viewerWallet(): Promise<{ owner: Owner; name: string; viewAs: boolean } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role === "LIVREUR") {
    const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { livreur: { select: { id: true, name: true } } } });
    return u?.livreur ? { owner: { type: "LIVREUR", id: u.livreur.id }, name: u.livreur.name, viewAs: false } : null;
  }
  const me = await getReseller();
  return me ? { owner: { type: "CONSULTANT", id: me.id }, name: me.name, viewAs: me.viewAs } : null;
}
