import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-page-guard";

/** Les commissions sont créditées dans le wallet JAMAAL ; retraits et payouts sont gérés dans Wallets. */
export default async function VersementsPage() {
  await requireAdminPage("comptabilite");
  redirect("/admin/wallets");
}
