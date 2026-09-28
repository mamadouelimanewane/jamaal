import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { formationArticles } from "@/data/onboarding";
import { getOnboardingAutoStatus } from "@/lib/actions/onboarding";
import { OnboardingChecklist } from "@/components/admin/OnboardingChecklist";

export const dynamic = "force-dynamic";

/**
 * Destination : src/app/(admin)/admin/(dashboard)/formation/page.tsx
 */
export default async function FormationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");
  if (session.user.role !== "CONSULTANT" && session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  let autoCompleted: Awaited<ReturnType<typeof getOnboardingAutoStatus>> = {};
  if (session.user.role === "CONSULTANT") {
    try {
      autoCompleted = await getOnboardingAutoStatus();
    } catch {
      autoCompleted = {};
    }
  }

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Formation</h1>
      <p className="mt-1 text-sm text-navy/60">
        Checklist de démarrage et guides pour réussir en tant que consultant·e JAMAAL.
      </p>

      {session.user.role === "CONSULTANT" && (
        <div className="mt-8 max-w-lg">
          <OnboardingChecklist autoCompleted={autoCompleted} />
        </div>
      )}

      <section className="mt-12 space-y-6">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Guides</h2>
        {formationArticles.map((article) => (
          <article
            key={article.id}
            id={article.id}
            className="rounded-2xl border border-line bg-white p-6"
          >
            <h3 className="text-base font-semibold text-navy">{article.title}</h3>
            <p className="mt-1 text-sm text-navy/60">{article.excerpt}</p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-navy/80">
              {article.content.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </article>
        ))}
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/admin/outils"
          className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light"
        >
          Outils de vente →
        </Link>
        <Link
          href="/admin"
          className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-navy"
        >
          Tableau de bord
        </Link>
      </div>
    </div>
  );
}
