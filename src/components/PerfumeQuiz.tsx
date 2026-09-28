"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  quizSteps,
  familyKeywords,
  genderCategory,
  type QuizAnswers,
  type QuizFamily,
  type QuizGender,
} from "@/data/perfume-quiz";

export interface QuizProduct {
  id: string;
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  family?: string | null;
  topNotes?: string[];
  heartNotes?: string[];
  baseNotes?: string[];
  testerPrice?: number | null;
}

function scoreProduct(p: QuizProduct, answers: QuizAnswers): number {
  let score = 0;
  if (answers.gender) {
    const cats = genderCategory[answers.gender];
    if (cats.includes(p.category)) score += 3;
  }
  if (answers.family) {
    const keys = familyKeywords[answers.family as QuizFamily];
    const blob = [
      p.family,
      p.shortDescription,
      ...(p.topNotes || []),
      ...(p.heartNotes || []),
      ...(p.baseNotes || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (keys.some((k) => blob.includes(k))) score += 4;
  }
  if (answers.intensity === "intense") score += 1;
  if (answers.occasion === "soiree") score += 1;
  return score;
}

export function PerfumeQuiz({ products }: { products: QuizProduct[] }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({
    gender: null,
    occasion: null,
    family: null,
    intensity: null,
  });
  const [done, setDone] = useState(false);

  const current = quizSteps[step];

  const results = useMemo(() => {
    if (!done) return [];
    return [...products]
      .map((p) => ({ p, s: scoreProduct(p, answers) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => x.p);
  }, [done, products, answers]);

  function choose(value: string) {
    const key = current.key;
    setAnswers((a) => ({ ...a, [key]: value }));
    if (step < quizSteps.length - 1) {
      setStep(step + 1);
    } else {
      setDone(true);
    }
  }

  function restart() {
    setStep(0);
    setAnswers({ gender: null, occasion: null, family: null, intensity: null });
    setDone(false);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Vos suggestions JAMAAL
        </h1>
        <p className="mt-2 text-sm text-navy/60">
          Selon vos réponses, voici des fragrances qui devraient vous plaire.
        </p>

        {results.length === 0 ? (
          <p className="mt-8 text-sm text-navy/60">
            Aucune correspondance précise — explorez tout le catalogue.
          </p>
        ) : (
          <ul className="mt-8 space-y-4">
            {results.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-white p-4"
              >
                <div>
                  <Link
                    href={`/produits/${p.slug}`}
                    className="text-sm font-semibold text-navy hover:underline"
                  >
                    {p.name}
                  </Link>
                  <p className="mt-1 text-xs text-navy/60 line-clamp-2">{p.shortDescription}</p>
                </div>
                <Link
                  href={`/produits/${p.slug}`}
                  className="shrink-0 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Voir
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={restart}
            className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-navy"
          >
            Refaire le quiz
          </button>
          <Link href="/" className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white">
            Voir le catalogue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-rose-dark">
        Quiz parfum · {step + 1}/{quizSteps.length}
      </p>
      <h1 className="mt-3 font-serif-display text-2xl font-semibold text-navy">
        {current.question}
      </h1>
      <div className="mt-8 flex flex-col gap-3">
        {current.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => choose(opt.value)}
            className="rounded-2xl border border-line bg-white px-5 py-4 text-left text-sm font-semibold text-navy transition hover:border-navy hover:bg-navy/5"
          >
            {opt.label}
          </button>
        ))}
      </div>
      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          className="mt-6 text-sm font-semibold text-navy/50 hover:text-navy"
        >
          ← Retour
        </button>
      )}
    </div>
  );
}
