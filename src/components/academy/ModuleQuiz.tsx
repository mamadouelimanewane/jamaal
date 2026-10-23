"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, RotateCcw } from "lucide-react";
import { submitQuiz } from "@/lib/actions/growth";
import type { QuizQuestion } from "@/data/quiz-formation";

type Result = Awaited<ReturnType<typeof submitQuiz>>;

/** Quiz d'un module de l'Académie : une question à la fois, correction, validation à 80 %, badge obtenu. */
export function ModuleQuiz({ moduleId, questions, best }: { moduleId: string; questions: QuizQuestion[]; best: { score: number; total: number } | null }) {
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const i = answers.length;

  const choose = (k: number) => {
    const next = [...answers, k];
    setAnswers(next);
    if (next.length >= questions.length)
      start(async () => {
        try {
          setResult(await submitQuiz(moduleId, next));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Correction impossible.");
        }
      });
  };
  const restart = () => {
    setAnswers([]);
    setResult(null);
    setError(null);
  };

  if (error) return <p role="alert" className="rounded-2xl bg-rose/10 p-4 text-sm text-rose-dark">{error}</p>;
  if (result)
    return (
      <div className="space-y-4">
        {result.newBadge && (
          <div className="rounded-3xl bg-gradient-to-br from-amber-100 to-rose/20 p-6 text-center">
            <p className="text-4xl">🏅</p>
            <p className="mt-2 font-serif-display text-2xl font-semibold text-navy">Badge obtenu : {result.newBadge}</p>
            <p className="mt-1 text-sm text-navy/75">Il s&apos;affiche maintenant sur votre boutique personnelle : vos clients le voient.</p>
            <Link href="/admin/ma-boutique" className="mt-3 inline-block rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white">Voir ma boutique</Link>
          </div>
        )}
        <div className={`rounded-2xl p-4 ${result.passed ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
          <p className="text-lg font-semibold">{result.score} / {result.total} · {result.passed ? "Module validé ✅" : "Pas encore : 80 % de bonnes réponses pour valider"}</p>
        </div>
        <ul className="space-y-2">
          {result.corrections.map((c) => (
            <li key={c.question} className={`rounded-xl px-3 py-2 text-sm ${c.ok ? "bg-ia-light/60" : "bg-rose/10"} text-navy`}>
              <p className="font-medium">{c.ok ? "✅" : "❌"} {c.question}</p>
              {!c.ok && <p className="text-xs">Bonne réponse : {c.good}</p>}
              <p className="text-xs text-navy/70">{c.explanation}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {!result.passed && <button type="button" onClick={restart} className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white"><RotateCcw size={15} /> Recommencer le quiz</button>}
          <Link href="/admin/academie" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-navy hover:bg-cream">Retour à l&apos;Académie</Link>
        </div>
      </div>
    );

  if (pending || i >= questions.length) return <p className="flex items-center gap-2 text-sm text-navy/70"><Loader2 size={16} className="animate-spin" /> Correction…</p>;
  const q = questions[i];
  return (
    <div>
      <div className="flex items-center justify-between text-sm text-navy/60">
        <span>Question {i + 1} / {questions.length}</span>
        {best && <span>Meilleur score : {best.score}/{best.total}</span>}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-ia" style={{ width: `${(i / questions.length) * 100}%` }} /></div>
      <p className="mt-4 font-semibold text-navy">{q.question}</p>
      <div className="mt-3 grid gap-2">
        {q.choices.map((c, k) => (
          <button key={c} type="button" onClick={() => choose(k)} className="rounded-xl border border-line px-4 py-3 text-left text-sm text-navy hover:border-ia hover:bg-ia-light/50">{c}</button>
        ))}
      </div>
    </div>
  );
}
