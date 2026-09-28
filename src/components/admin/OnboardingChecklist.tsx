"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { onboardingSteps, type OnboardingStepId } from "@/data/onboarding";

const STORAGE_KEY = "jamaal-onboarding-manual";

type ManualState = Partial<Record<OnboardingStepId, boolean>>;

export function OnboardingChecklist({
  autoCompleted,
}: {
  /** Étapes auto validées côté serveur */
  autoCompleted: Partial<Record<OnboardingStepId, boolean>>;
}) {
  const [manual, setManual] = useState<ManualState>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setManual(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  function toggle(id: OnboardingStepId) {
    setManual((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function isDone(id: OnboardingStepId, auto: boolean) {
    if (auto) return !!autoCompleted[id];
    return !!manual[id];
  }

  const doneCount = onboardingSteps.filter((s) => isDone(s.id, s.auto)).length;
  const total = onboardingSteps.length;
  const pct = Math.round((doneCount / total) * 100);

  if (!ready) {
    return (
      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="text-sm text-navy/50">Chargement de votre progression…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-navy">Démarrage consultant</h2>
          <p className="mt-0.5 text-xs text-navy/50">
            {doneCount}/{total} étapes · {pct}%
          </p>
        </div>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-navy/10">
          <div className="h-full rounded-full bg-rose-dark transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {onboardingSteps.map((step) => {
          const done = isDone(step.id, step.auto);
          return (
            <li
              key={step.id}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
                done ? "border-emerald-200 bg-emerald-50/50" : "border-line bg-white"
              }`}
            >
              {step.auto ? (
                <span className="mt-0.5 shrink-0 text-emerald-600">
                  {done ? <CheckCircle2 size={18} /> : <Circle size={18} className="text-navy/30" />}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(step.id)}
                  className="mt-0.5 shrink-0 text-navy/40 hover:text-emerald-600"
                  aria-label={done ? "Marquer non fait" : "Marquer fait"}
                >
                  {done ? (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  ) : (
                    <Circle size={18} />
                  )}
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${done ? "text-navy/50 line-through" : "text-navy"}`}>
                  {step.title}
                </p>
                <p className="text-xs text-navy/50">{step.description}</p>
                {step.href && !done && (
                  <Link href={step.href} className="mt-1 inline-block text-xs font-semibold text-rose-dark hover:underline">
                    Y aller →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
