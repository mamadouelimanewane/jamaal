import "dotenv/config";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { products } from "../src/data/products";
import { consultants } from "../src/data/consultants";
import { blogPosts } from "../src/data/blog";

async function main() {
  console.log(`Seeding ${products.length} produits...`);
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        number: p.number ?? null,
        name: p.name,
        category: p.category,
        family: p.family ?? null,
        topNotes: p.topNotes ?? [],
        heartNotes: p.heartNotes ?? [],
        baseNotes: p.baseNotes ?? [],
        shortDescription: p.shortDescription,
        longDescription: p.longDescription,
        testerPrice: p.testerPrice ?? null,
        volumes: (p.volumes as Prisma.InputJsonValue | undefined) ?? undefined,
        regularPrice: p.regularPrice ?? null,
        reviewCount: p.reviewCount,
        rating: p.rating,
        badge: p.badge ?? null,
        colorFrom: p.colorFrom,
        colorTo: p.colorTo,
        photo: p.photo ?? null,
        isOfficial: p.isOfficial ?? false,
      },
      create: {
        slug: p.slug,
        number: p.number ?? null,
        name: p.name,
        category: p.category,
        family: p.family ?? null,
        topNotes: p.topNotes ?? [],
        heartNotes: p.heartNotes ?? [],
        baseNotes: p.baseNotes ?? [],
        shortDescription: p.shortDescription,
        longDescription: p.longDescription,
        testerPrice: p.testerPrice ?? null,
        volumes: (p.volumes as Prisma.InputJsonValue | undefined) ?? undefined,
        regularPrice: p.regularPrice ?? null,
        reviewCount: p.reviewCount,
        rating: p.rating,
        badge: p.badge ?? null,
        colorFrom: p.colorFrom,
        colorTo: p.colorTo,
        photo: p.photo ?? null,
        isOfficial: p.isOfficial ?? false,
      },
    });
  }

  console.log(`Seeding ${consultants.length} consultants...`);
  for (const c of consultants) {
    const existing = await prisma.consultant.findFirst({ where: { name: c.name } });
    if (!existing) {
      await prisma.consultant.create({
        data: { name: c.name, city: c.city, whatsapp: c.whatsapp },
      });
    }
  }

  console.log(`Seeding ${blogPosts.length} articles de blog...`);
  for (const b of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: b.slug },
      update: {
        title: b.title,
        excerpt: b.excerpt,
        content: b.content,
        date: new Date(b.date),
      },
      create: {
        slug: b.slug,
        title: b.title,
        excerpt: b.excerpt,
        content: b.content,
        date: new Date(b.date),
      },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@jamaal.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Jamaal2026!";
  const adminHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      name: "Administrateur JAMAAL",
      role: "ADMIN",
    },
  });
  console.log(`Compte ADMIN prêt : ${adminEmail} / ${adminPassword}`);

  const consultantEmail = process.env.SEED_CONSULTANT_EMAIL ?? "consultant@jamaal.com";
  const consultantPassword = process.env.SEED_CONSULTANT_PASSWORD ?? "Jamaal2026!";
  const consultantHash = await bcrypt.hash(consultantPassword, 10);
  await prisma.user.upsert({
    where: { email: consultantEmail },
    update: {},
    create: {
      email: consultantEmail,
      passwordHash: consultantHash,
      name: "Consultant Démo",
      role: "CONSULTANT",
    },
  });
  console.log(`Compte CONSULTANT prêt : ${consultantEmail} / ${consultantPassword}`);

  console.log("Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
