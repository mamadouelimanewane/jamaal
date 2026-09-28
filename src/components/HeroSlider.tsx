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
      className="relative flex min-h-[420px] items-center overflow-hidden sm:min-h-[500px] transition-colors duration-1000 ease-in-out"
      style={{ background: `linear-gradient(135deg, ${slide.colorFrom}, ${slide.colorTo})` }}
    >
      <div
        key={index}
        className="mx-auto flex w-full max-w-7xl flex-col items-start gap-5 px-6 py-16 sm:px-10 animate-fade-in"
      >
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white backdrop-blur-sm">
          JAMAAL Luxury Cosmetics
        </span>
        <h1 className="max-w-xl font-serif-display text-4xl font-semibold leading-tight text-white drop-shadow-md sm:text-5xl">
          {slide.title}
        </h1>
        <p className="max-w-md text-base text-white/90 drop-shadow-sm sm:text-lg">
          {slide.subtitle}
        </p>
        <Link
          href={slide.href}
          className="mt-4 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-navy shadow-lg transition-transform duration-300 hover:scale-105 hover:bg-cream hover:shadow-xl"
        >
          {slide.cta} →
        </Link>
      </div>

      <button
        aria-label="Précédent"
        onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-white/30 sm:left-6"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        aria-label="Suivant"
        onClick={() => setIndex((i) => (i + 1) % slides.length)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-white/30 sm:right-6"
      >
        <ChevronRight size={24} />
      </button>

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            aria-label={`Diapositive ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
              i === index ? "w-8 bg-white shadow-sm" : "w-2 bg-white/40 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
