import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { geminiConfigured } from "@/lib/ai/gemini";
import { AssistantChat } from "@/components/admin/AssistantChat";

export const dynamic = "force-dynamic";

/** Assistant IA : questions en langage naturel sur le catalogue, le stock et les données de l'application. */
export default async function AssistantPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");
  const role = session.user.role;
  const enabled = geminiConfigured();

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Assistant IA</h1>
      <p className="mt-1 mb-4 text-sm text-stone-500">
        {role === "ADMIN"
          ? "Interrogez le catalogue, le stock, les commandes, les clients et les revendeurs."
          : role === "CONSULTANT"
            ? "Interrogez le catalogue et le stock, vos commandes, vos clients et vos ventes."
            : "Interrogez le catalogue, le stock et vos livraisons."}{" "}
        L&apos;assistant consulte les données sans rien modifier.
      </p>
      {!enabled && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {role === "ADMIN"
            ? "Pour activer l'assistant, ajoutez la variable GOOGLE_AI_API_KEY (clé gratuite sur aistudio.google.com) dans les réglages Vercel, puis redéployez."
            : "L'assistant n'est pas encore activé par l'administrateur."}
        </p>
      )}
      <AssistantChat role={role} enabled={enabled} />
    </div>
  );
}
