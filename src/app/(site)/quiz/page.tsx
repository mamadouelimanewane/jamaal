import { prisma } from "@/lib/prisma";
import { PerfumeQuiz } from "@/components/PerfumeQuiz";

export const dynamic = "force-dynamic";

/**
 * Destination : src/app/(site)/quiz/page.tsx
 * Route publique : /quiz
 */
export default async function QuizPage() {
  const products = await prisma.product.findMany({
    where: {
      category: { in: ["parfum-femme", "parfum-homme", "parfum-unisexe"] },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      shortDescription: true,
      family: true,
      topNotes: true,
      heartNotes: true,
      baseNotes: true,
      testerPrice: true,
    },
    take: 200,
  });

  return <PerfumeQuiz products={products} />;
}
