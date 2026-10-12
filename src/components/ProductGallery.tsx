"use client";

import Image from "next/image";
import { useState } from "react";

/** Photo principale + vignettes cliquables (fiches qui ont plusieurs photos, ex. import Chogan). */
export function ProductGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const current = photos[Math.min(index, photos.length - 1)];
  return (
    <div>
      <div className="relative aspect-[4/4.5] w-full overflow-hidden">
        <Image key={current} src={current} alt={index === 0 ? alt : `${alt} — photo ${index + 1}`} fill sizes="(max-width: 1024px) 100vw, 54vw" className="h-full w-full object-contain p-5 sm:p-10 lg:p-14" priority={index === 0} />
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-16 sm:px-6" role="group" aria-label="Photos du produit">
        {photos.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Afficher la photo ${i + 1} sur ${photos.length}`}
            aria-current={i === index}
            className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white transition sm:h-20 sm:w-20 ${i === index ? "border-navy ring-2 ring-navy/20" : "border-line hover:border-navy/50"}`}
          >
            <Image src={src} alt="" fill sizes="80px" className="object-contain p-1" />
          </button>
        ))}
      </div>
    </div>
  );
}
