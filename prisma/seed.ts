import "dotenv/config";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { products } from "../src/data/products";
import { consultants } from "../src/data/consultants";
import { blogPosts } from "../src/data/blog";
import { categories } from "../src/data/categories";

async function main() {
  // Le catalogue est désormais géré en direct depuis le back-office (/admin/produits).
  // On ne crée ici QUE les produits absents de la base, sans jamais écraser les
  // modifications déjà faites depuis l'admin (prix, stock, description, etc.).
  const existingSlugs = new Set((await prisma.product.findMany({ select: { slug: true } })).map((p) => p.slug));
  const newProducts = products.filter((p) => !existingSlugs.has(p.slug));
  console.log(`${products.length} produits dans le catalogue de référence, ${newProducts.length} nouveaux à créer...`);
  for (const p of newProducts) {
    await prisma.product.create({
      data: {
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
        publicPrice: p.publicPrice ?? null,
        reviewCount: p.reviewCount,
        rating: p.rating,
        badge: p.badge ?? null,
        colorFrom: p.colorFrom,
        colorTo: p.colorTo,
        photo: p.photo ?? null,
        isOfficial: p.isOfficial ?? false,
        stock: 25,
      },
    });
  }

  console.log(`Seeding ${categories.length} catégories...`);
  for (const [index, c] of categories.entries()) {
    const existing = await prisma.category.findUnique({ where: { slug: c.slug } });
    if (existing) continue;
    await prisma.category.create({
      data: {
        slug: c.slug,
        label: c.label,
        navLabel: c.navLabel,
        description: c.description,
        accent: c.accent,
        position: index,
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
    const existing = await prisma.blogPost.findUnique({ where: { slug: b.slug } });
    if (!existing) {
      await prisma.blogPost.create({
        data: {
          slug: b.slug,
          title: b.title,
          excerpt: b.excerpt,
          content: b.content,
          date: new Date(b.date),
        },
      });
    }
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

  const demoConsultant =
    (await prisma.consultant.findFirst({ where: { name: "Consultant Démo" } })) ??
    (await prisma.consultant.create({
      data: { name: "Consultant Démo", city: "Dakar", whatsapp: "https://wa.me/221770000000" },
    }));

  const consultantEmail = process.env.SEED_CONSULTANT_EMAIL ?? "consultant@jamaal.com";
  const consultantPassword = process.env.SEED_CONSULTANT_PASSWORD ?? "Jamaal2026!";
  const consultantHash = await bcrypt.hash(consultantPassword, 10);
  await prisma.user.upsert({
    where: { email: consultantEmail },
    update: { consultantId: demoConsultant.id },
    create: {
      email: consultantEmail,
      passwordHash: consultantHash,
      name: "Consultant Démo",
      role: "CONSULTANT",
      consultantId: demoConsultant.id,
    },
  });
  console.log(`Compte CONSULTANT prêt : ${consultantEmail} / ${consultantPassword}`);

  const demoLivreur = await (async () => {
    const existing = await prisma.livreur.findFirst({ where: { name: "Livreur Démo" } });
    return existing ?? prisma.livreur.create({ data: { name: "Livreur Démo", phone: "https://wa.me/221780000000" } });
  })();

  const livreurEmail = process.env.SEED_LIVREUR_EMAIL ?? "livreur@jamaal.com";
  const livreurPassword = process.env.SEED_LIVREUR_PASSWORD ?? "Jamaal2026";
  const livreurHash = await bcrypt.hash(livreurPassword, 10);
  await prisma.user.upsert({
    where: { email: livreurEmail },
    update: { livreurId: demoLivreur.id },
    create: {
      email: livreurEmail,
      passwordHash: livreurHash,
      name: "Livreur Démo",
      role: "LIVREUR",
      livreurId: demoLivreur.id,
    },
  });
  console.log(`Compte LIVREUR prêt : ${livreurEmail} / ${livreurPassword}`);

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
