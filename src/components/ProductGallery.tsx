"use client";

import Image from "next/image";
import { useState } from "react";
import { Play } from "lucide-react";
import { isVideoUrl } from "@/lib/media";

/** Photo principale + vignettes cliquables (plusieurs photos, ex. import Chogan, et vidéos du produit). */
export function ProductGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const current = photos[Math.min(index, photos.length - 1)];
  return (
    <div className="w-full min-w-0">
      <div className="relative aspect-[4/4.5] w-full overflow-hidden">
        {isVideoUrl(current) ? (
          <video key={current} src={current} controls playsInline preload="metadata" aria-label={`${alt} — vidéo`} className="h-full w-full bg-black object-contain" />
        ) : (
          <Image key={current} src={current} alt={index === 0 ? alt : `${alt} — photo ${index + 1}`} fill sizes="(max-width: 1024px) 100vw, 54vw" className="h-full w-full object-contain p-5 sm:p-10 lg:p-14" priority={index === 0} />
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-16 sm:px-6" role="group" aria-label="Photos du produit">
        {photos.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={isVideoUrl(src) ? `Voir la vidéo (${i + 1} sur ${photos.length})` : `Afficher la photo ${i + 1} sur ${photos.length}`}
            aria-current={i === index}
            className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white transition sm:h-20 sm:w-20 ${i === index ? "border-navy ring-2 ring-navy/20" : "border-line hover:border-navy/50"}`}
          >
            {isVideoUrl(src) ? (
              <>
                <video src={`${src}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-hidden="true" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white"><Play size={20} fill="currentColor" /></span>
              </>
            ) : (
              <Image src={src} alt="" fill sizes="80px" className="object-contain p-1" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
