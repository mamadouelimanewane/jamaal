import { prisma } from "./prisma";

export async function getConsultants() {
  const list = await prisma.consultant.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  // Annuaire public : le nom de la boutique remplace celui du revendeur quand il est rempli.
  return list.map((c) => ({ ...c, name: c.shopName ?? c.name }));
}

export async function getBlogPosts(limit?: number) {
  return prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { date: "desc" },
    take: limit,
  });
}

export async function getBlogPostBySlug(slug: string) {
  return prisma.blogPost.findUnique({ where: { slug } });
}
