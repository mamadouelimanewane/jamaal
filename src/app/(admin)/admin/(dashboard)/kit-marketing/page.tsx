import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { createMarketingAsset, deleteMarketingAsset } from "@/lib/actions/marketing-assets";
import { MediaListEditor } from "@/components/admin/MediaListEditor";
import { MediaView } from "@/components/MediaView";
import { isVideoUrl } from "@/lib/media";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kit marketing" };

const CATEGORIES = ["Général", "Parfums", "Soins", "Promotions", "Témoignages", "Formation"];

/**
 * Kit marketing des revendeurs : l'équipe ajoute des photos et des vidéos (depuis la galerie du téléphone ou
 * de l'ordinateur), avec un texte à publier. Les revendeurs les retrouvent dans « Mon kit marketing »,
 * prêtes à partager en statut WhatsApp, sur TikTok, Instagram ou Facebook.
 */
export default async function KitMarketingAdminPage() {
  await requireAdmin("marketing");
  const assets = await prisma.marketingAsset.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Kit marketing des revendeurs</h1>
      <p className="mt-1 text-sm text-navy/75">
        Ajoutez des photos et des vidéos : elles apparaissent aussitôt dans « Mon kit marketing » de chaque revendeur, avec votre texte, prêtes à publier.
      </p>

      <form action={createMarketingAsset} className="mt-6 space-y-4 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold text-navy">Ajouter une photo ou une vidéo</h2>
        <MediaListEditor name="fileUrl" initial={[]} scope="kit" max={1} title="Photo ou vidéo" />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-navy">
            Titre
            <input name="title" required maxLength={120} placeholder="Ex. Nouveau parfum Prestige en vidéo" className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-navy" />
          </label>
          <label className="block text-sm font-medium text-navy">
            Rubrique
            <select name="category" defaultValue="Général" className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium text-navy">
          Texte à publier avec <span className="font-normal text-navy/60">(facultatif ; copié pour le revendeur quand il partage)</span>
          <textarea name="caption" rows={3} maxLength={1000} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-navy" />
        </label>
        <button className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light">Publier dans le kit</button>
      </form>

      <h2 className="mt-8 font-semibold text-navy">Dans le kit ({assets.length})</h2>
      {assets.length ? (
        <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="relative aspect-[4/5] bg-navy/5">
                <MediaView src={a.fileUrl} alt={a.title} fit="contain" className="h-full w-full" />
                {isVideoUrl(a.fileUrl) && <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">Vidéo</span>}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-semibold text-navy">{a.title}</p>
                <p className="text-xs text-navy/60">{a.category} · {a.createdAt.toLocaleDateString("fr-FR")}</p>
                {a.caption && <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-navy/75">{a.caption}</p>}
                <form action={deleteMarketingAsset.bind(null, a.id)} className="mt-2">
                  <button className="inline-flex items-center gap-1 text-xs font-semibold text-rose-dark hover:underline">
                    <Trash2 size={13} /> Retirer du kit
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl bg-cream/60 p-4 text-sm text-navy/70">Le kit est vide : ajoutez une première photo ou vidéo.</p>
      )}
    </div>
  );
}
