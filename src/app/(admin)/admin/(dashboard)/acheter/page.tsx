import { redirect } from "next/navigation";

/** « Acheter un produit » (menu du revendeur) : la commande, pour soi ou pour un client. */
export default async function BuyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => !!e[1])).toString();
  redirect(`/admin/mes-commandes/nouvelle${q ? `?${q}` : ""}`);
}
