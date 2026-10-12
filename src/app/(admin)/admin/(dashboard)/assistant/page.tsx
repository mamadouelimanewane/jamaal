import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { geminiConfigured } from "@/lib/ai/gemini";
import { AssistantPanel } from "@/components/admin/AdminAssistant";

export const dynamic = "force-dynamic";
// L'assistant peut enchaîner plusieurs appels à l'IA et à la base : 60 s laissées à la réponse.
export const maxDuration = 60;

/** Assistant IA : questions en langage naturel sur le catalogue, le stock et les données de l'application. */
export default async function AssistantPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");
  const role = session.user.role;

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Assistant IA</h1>
      <p className="mt-1 mb-4 text-sm text-navy/70">
        {role === "ADMIN"
          ? "Interrogez le catalogue, le stock, les commandes, les clients et les revendeurs."
          : role === "CONSULTANT"
            ? "Interrogez le catalogue et le stock, vos commandes, vos clients et vos ventes."
            : "Interrogez le catalogue, le stock et vos livraisons."}{" "}
        Aussi disponible sur toutes les pages par le bouton « Assistant » en bas à droite.
      </p>
      <div className="h-[calc(100dvh-12rem)] min-h-[460px] overflow-hidden rounded-3xl border border-line bg-white shadow-lg shadow-navy/10">
        <AssistantPanel role={role} enabled={geminiConfigured()} variant="page" />
      </div>
    </div>
  );
}
