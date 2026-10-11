import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { CustomerAuthForms } from "@/components/account/CustomerAuthForms";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/compte" });
}

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Mon compte</h1>
        <p className="mt-2 text-sm text-navy/70">Connectez-vous ou créez un compte pour suivre vos commandes.</p>
        <div className="mt-6"><CustomerAuthForms /></div>
      </div>
    );
  }

  if (session.user.role !== "CLIENT") {
    return (
      <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Mon compte</h1>
        <p className="mt-3 text-sm text-navy/70">
          Vous êtes connecté avec un compte de l&apos;équipe JAMAAL. Cet espace est réservé aux comptes clients.
        </p>
        <Link href="/admin" className="mt-4 inline-block font-semibold text-rose-dark hover:underline">
          Aller à l&apos;espace équipe →
        </Link>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { customer: { include: { orders: { orderBy: { createdAt: "desc" } } } } },
  });
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Mon compte</h1>
        <p className="mt-3 text-sm text-navy/70">Compte introuvable.</p>
      </div>
    );
  }

  const orders = user.customer?.orders ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Mon compte</h1>
        <form action={logoutAction}>
          <button className="text-sm font-semibold text-navy/70 hover:underline">Se déconnecter</button>
        </form>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5 text-sm">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Mes informations</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr]">
          <dt className="text-navy/70">Nom</dt>
          <dd className="text-navy">{user.name}</dd>
          <dt className="text-navy/70">E-mail</dt>
          <dd className="text-navy">{user.email ?? "—"}</dd>
          <dt className="text-navy/70">Téléphone</dt>
          <dd className="text-navy">{user.phone ?? "—"}</dd>
        </dl>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5 text-sm">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Mes commandes</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-navy/70">Aucune commande pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-medium text-navy">{formatPrice(o.total)}</p>
                  <p className="text-xs text-navy/60">{o.createdAt.toLocaleDateString("fr-FR")}</p>
                </div>
                <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-navy/80">
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Changer mon mot de passe</h2>
        <div className="mt-4"><ChangePasswordForm /></div>
      </div>
    </div>
  );
}
