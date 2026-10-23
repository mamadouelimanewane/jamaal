import { redirect } from "next/navigation";

/** L'ancien quiz est remplacé par le « Parfum ADN ». */
export default async function QuizPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  redirect(ref ? `/parfum-adn?ref=${encodeURIComponent(ref)}` : "/parfum-adn");
}
