import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/ref";

/** Slug de consultant unique (nom → "aminata", "aminata-2", …). */
export async function uniqueConsultantSlug(name: string): Promise<string> {
  const base = slugify(name) || "consultant";
  let candidate = base;
  for (let i = 2; ; i++) {
    const taken = await prisma.consultant.findFirst({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
    candidate = `${base}-${i}`;
  }
}
