import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { Bike, MapPin, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function timeAgo(date: Date | null): string {
  if (!date) return "Jamais";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  return `Il y a ${hours} h`;
}

export default async function FleetMapPage() {
  await requireAdmin();

  const livreurs = await prisma.livreur.findMany({
    where: { active: true },
    include: {
      orders: {
        where: { status: { in: ["CONFIRMEE", "EXPEDIEE"] } },
        select: { id: true, customerName: true, address: true, total: true },
      },
    },
  });

  const livreursWithCoords = livreurs.filter((l) => l.lastLat && l.lastLng);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/livreurs"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-navy hover:bg-cream"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-serif-display text-2xl font-semibold text-navy">
              Carte globale des livreurs (Flotte GPS)
            </h1>
            <p className="text-sm text-navy/75">
              Position en temps réel de vos {livreursWithCoords.length} livreur(s) géolocalisé(s).
            </p>
          </div>
        </div>

        <Link
          href="/admin/livreurs"
          className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
        >
          Voir la liste des livreurs
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Liste latérale */}
        <div className="space-y-3 lg:col-span-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-navy/70">
            Livreurs actifs ({livreurs.length})
          </h2>
          {livreurs.length === 0 ? (
            <p className="text-sm text-navy/75">Aucun livreur enregistrer.</p>
          ) : (
            livreurs.map((l) => (
              <div
                key={l.id}
                className="rounded-2xl border border-line bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-navy">
                    <Bike size={18} className="text-emerald-600" />
                    <span>{l.name}</span>
                  </div>
                  {l.lastLat && l.lastLng ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      GPS Actif
                    </span>
                  ) : (
                    <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-semibold text-navy/65">
                      Pas de signal
                    </span>
                  )}
                </div>

                <div className="mt-2 text-xs text-navy/75 space-y-1">
                  <p>Tél: {l.phone}</p>
                  <p>Dernière position : {timeAgo(l.lastSeenAt)}</p>
                  <p className="font-medium text-navy/90">
                    Livraisons en cours :{" "}
                    <span className="font-bold text-rose-dark">
                      {l.orders.length}
                    </span>
                  </p>
                </div>

                {l.orders.length > 0 && (
                  <div className="mt-3 border-t border-line/60 pt-2 text-xs text-navy/85 space-y-1">
                    {l.orders.map((o) => (
                      <div key={o.id} className="truncate">
                        • {o.customerName} ({o.address || "Adresse N/A"})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Zone de carte */}
        <div className="lg:col-span-2">
          {livreursWithCoords.length === 0 ? (
            <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-line bg-cream/50 p-6 text-center">
              <MapPin size={40} className="text-navy/55" />
              <p className="mt-3 font-serif-display text-lg font-semibold text-navy">
                Aucun livreur n&apos;émet de signal GPS
              </p>
              <p className="mt-1 max-w-sm text-xs text-navy/75">
                Les livreurs doivent cliquer sur le bouton &quot;Activer le suivi en direct&quot; depuis leur espace sur leur smartphone.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {livreursWithCoords.map((l) => (
                <div key={l.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-line bg-cream px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-navy">
                      <Bike size={16} className="text-emerald-600" />
                      <span>{l.name}</span>
                    </div>
                    <span className="text-xs text-navy/70">
                      Mise à jour : {timeAgo(l.lastSeenAt)}
                    </span>
                  </div>
                  <iframe
                    title={`Position de ${l.name}`}
                    src={`https://www.google.com/maps?q=${l.lastLat},${l.lastLng}&z=15&output=embed`}
                    className="h-80 w-full border-0"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
