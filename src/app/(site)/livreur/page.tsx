import { redirect } from "next/navigation";

/** Lien à partager aux livreurs (www.jamaal.sn/livreur) : application JAMAAL Livreur, à installer, puis inscription. */
export default function LivreurEntryPage() {
  redirect("/admin/livreur");
}
