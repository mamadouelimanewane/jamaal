import { prisma } from "./prisma";

export async function getConsultants() {
  return prisma.consultant.findMany({ where: { active: true }, orderBy: { name: "asc" } });
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
