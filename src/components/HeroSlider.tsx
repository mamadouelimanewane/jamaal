"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const slides = [
  {
    title: "Les Parfums JAMAAL",
    subtitle: "Des fragrances inspirées des plus grandes maisons, à prix juste",
    cta: "Découvrir les parfums femme",
    href: "/collections/parfum-femme",
    colorFrom: "#16233a",
    colorTo: "#c9997a",
  },
  {
    title: "JAMAAL Homme",
    subtitle: "Des sillages boisés et intenses pour affirmer votre style",
    cta: "Découvrir les parfums homme",
    href: "/collections/parfum-homme",
    colorFrom: "#24374f",
    colorTo: "#e4c4ab",
  },
  {
    title: "Aurodhea by JAMAAL",
    subtitle: "Une routine de soins visage et cheveux haut de gamme",
    cta: "Découvrir Aurodhea",
    href: "/collections/aurodhea",
    colorFrom: "#a97557",
    colorTo: "#16233a",
  },
];

export function HeroSlider() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, []);

  const slide = slides[index];

  return (
    <section
      className="relative flex min-h-[420px] items-center overflow-hidden sm:min-h-[500px]"
      style={{ background: `linear-gradient(135deg, ${slide.colorFrom}, ${slide.colorTo})` }}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-5 px-6 py-16 sm:px-10">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white">
          JAMAAL Luxury Cosmetics
        </span>
        <h1 className="max-w-xl font-serif-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
          {slide.title}
        </h1>
        <p className="max-w-md text-base text-white/85 sm:text-lg">{slide.subtitle}</p>
        <Link
          href={slide.href}
          className="mt-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-navy transition hover:bg-rose-light"
        >
          {slide.cta} →
        </Link>
      </div>

      <button
        aria-label="Précédent"
        onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        aria-label="Suivant"
        onClick={() => setIndex((i) => (i + 1) % slides.length)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
      >
        <ChevronRight size={20} />
      </button>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            aria-label={`Diapositive ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
