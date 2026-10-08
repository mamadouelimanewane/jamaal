import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

/** Profil du consultant connecté (null si la session n'est pas celle d'un consultant). */
const withSponsor = { sponsor: { select: { id: true, name: true, whatsapp: true, city: true } } } as const;

export async function getReseller() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Un administrateur peut consulter l'espace d'un consultant (cookie posé par startViewAsReseller).
  if (session.user.role === "ADMIN") {
    const viewAs = (await cookies()).get("jamaal_viewas")?.value;
    if (!viewAs) return null;
    const c = await prisma.consultant.findUnique({ where: { id: viewAs }, include: { ...withSponsor, user: { select: { id: true, name: true } } } });
    return c ? { ...c, userId: c.user?.id ?? session.user.id, userName: c.user?.name ?? c.name, viewAs: true as const } : null;
  }

  if (session.user.role !== "CONSULTANT") return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { consultant: { include: withSponsor } } });
  return user?.consultant ? { ...user.consultant, userId: user.id, userName: user.name, viewAs: false as const } : null;
}

export type Reseller = NonNullable<Awaited<ReturnType<typeof getReseller>>>;

/** Liens personnels du consultant (boutique, recrutement) avec son code d'attribution. */
export async function resellerLinks(slug: string | null) {
  const origin = await getSiteUrl();
  return {
    origin,
    shop: slug ? `${origin}/c/${slug}` : null,
    recruit: slug ? `${origin}/devenir-consultant?ref=${slug}` : null,
    productLink: (productSlug: string) => `${origin}/produits/${productSlug}${slug ? `?ref=${slug}` : ""}`,
  };
}

export function startOfMonth(offset = 0): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

export const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
