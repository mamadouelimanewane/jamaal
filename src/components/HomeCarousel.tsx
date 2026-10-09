"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { SLIDE_THEMES, type HeroSlide } from "@/lib/home-slides";

type Slide = HeroSlide & { resolvedImage: string | null };

const OPTIMIZED = /^https:\/\/(cdn\.chogangroupspa\.com\/images\/prodotti\/|[\w-]+\.public\.blob\.vercel-storage\.com\/)/;
const DELAY = 6500;

/** Slogan : le texte entre *astérisques* est mis en valeur. */
function Title({ text, accent }: { text: string; accent: string }) {
  const parts = text.split(/\*([^*]+)\*/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <em key={i} className="font-normal" style={{ color: accent }}>
            {p}
          </em>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

/** Grand carrousel d'accueil : une diapositive par gamme, défilement automatique. */
export function HomeCarousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState(false);
  const touch = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback((n: number) => setIndex(((n % count) + count) % count), [count]);

  useEffect(() => {
    if (!playing || hover || count < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => go(index + 1), DELAY);
    return () => clearTimeout(t);
  }, [index, playing, hover, count, go]);

  if (!count) return null;

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="À la une chez JAMAAL"
      className="relative isolate overflow-hidden"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
        touch.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div className="relative min-h-[720px] sm:min-h-[680px]">
        {slides.map((s, i) => {
          const th = SLIDE_THEMES[s.theme] ?? SLIDE_THEMES.nuit;
          const current = i === index;
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="diapositive"
              aria-label={`${i + 1} sur ${count}`}
              aria-hidden={!current}
              inert={!current}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${current ? "z-10 opacity-100" : "z-0 opacity-0"}`}
              style={{ background: `linear-gradient(120deg, ${th.from} 0%, ${th.to} 100%)`, color: th.text }}
            >
              <div className="mx-auto grid h-full max-w-[1600px] grid-rows-[auto_1fr] lg:grid-cols-[0.92fr_1.08fr] lg:grid-rows-1">
                <div className="relative z-10 flex flex-col justify-center px-6 pb-6 pt-10 sm:px-10 sm:pt-12 lg:px-16 lg:pb-16 xl:px-24">
                  {s.eyebrow && <p className="luxury-eyebrow" style={{ color: th.accent }}>{s.eyebrow}</p>}
                  {i === 0 ? (
                    <h1 className="mt-5 max-w-2xl font-serif-display text-[2.5rem] font-normal leading-[1.05] tracking-[-0.03em] sm:text-6xl xl:text-[5rem]">
                      <Title text={s.title} accent={th.accent} />
                    </h1>
                  ) : (
                    <h2 className="mt-5 max-w-2xl font-serif-display text-[2.5rem] font-normal leading-[1.05] tracking-[-0.03em] sm:text-6xl xl:text-[5rem]">
                      <Title text={s.title} accent={th.accent} />
                    </h2>
                  )}
                  {s.subtitle && <p className="mt-6 max-w-lg text-sm leading-7 opacity-75 sm:text-base sm:leading-8">{s.subtitle}</p>}
                  <div className="mt-9">
                    <Link
                      href={s.href}
                      tabIndex={current ? 0 : -1}
                      className="inline-flex min-h-12 items-center justify-center gap-3 px-7 text-[11px] font-semibold uppercase tracking-[0.16em] transition hover:opacity-90"
                      style={{ background: th.accent, color: th.from }}
                    >
                      {s.ctaLabel} <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
                <Link href={s.href} tabIndex={-1} aria-hidden className="group relative mx-4 mb-20 block min-h-[180px] overflow-hidden sm:mx-8 lg:mx-0 lg:mb-0 lg:min-h-full">
                  {s.resolvedImage && s.image ? (
                    // Visuel envoyé dans le back-office : pleine largeur.
                    <Image
                      src={s.resolvedImage}
                      alt=""
                      fill
                      priority={i === 0}
                      unoptimized={!OPTIMIZED.test(s.resolvedImage)}
                      sizes="(max-width: 1024px) 100vw, 55vw"
                      className={`object-cover object-center transition duration-[7000ms] ease-out ${current ? "scale-[1.04]" : "scale-100"}`}
                    />
                  ) : s.resolvedImage ? (
                    // Photo produit (fond blanc) : présentée dans un écrin.
                    <div className="absolute inset-0 flex items-center justify-center p-6 lg:p-14" style={{ background: `radial-gradient(circle at 50% 50%, ${th.accent}40, transparent 65%)` }}>
                      <div className={`relative aspect-square h-full max-h-[480px] overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-black/30 transition duration-[7000ms] ease-out ${current ? "scale-[1.03]" : "scale-100"}`}>
                        <Image src={s.resolvedImage} alt="" fill priority={i === 0} unoptimized={!OPTIMIZED.test(s.resolvedImage)} sizes="(max-width: 1024px) 80vw, 480px" className="object-contain p-6" />
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 60% 40%, ${th.accent}55, transparent 60%)` }} />
                  )}
                  {s.image && <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-6 z-20 mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 sm:px-10 lg:px-16 xl:px-24">
          <div className="flex items-center gap-2" role="tablist" aria-label="Choisir une diapositive">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${s.eyebrow || s.title.replace(/\*/g, "")} (${i + 1}/${count})`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full bg-white transition-all ${i === index ? "w-9 opacity-95" : "w-4 opacity-40 hover:opacity-70"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 text-white">
            <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Mettre en pause" : "Lire le défilement"} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 transition hover:bg-white/10">
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button type="button" onClick={() => go(index - 1)} aria-label="Diapositive précédente" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 transition hover:bg-white/10">
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Diapositive suivante" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 transition hover:bg-white/10">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
