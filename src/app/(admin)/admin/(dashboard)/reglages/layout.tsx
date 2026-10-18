import { requireModulePage } from "@/lib/admin-page-guard";

/** Garde du module « reglages » : un administrateur dont le profil n'inclut pas ce module est renvoyé au tableau de bord. */
export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await requireModulePage("reglages");
  return children;
}
