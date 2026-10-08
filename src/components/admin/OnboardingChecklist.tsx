"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { onboardingSteps, type OnboardingStepId } from "@/data/onboarding";

const STORAGE_KEY = "jamaal-onboarding-manual";

type ManualState = Partial<Record<OnboardingStepId, boolean>>;

const LOCAL_EVENT = "jamaal-onboarding-change";

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_EVENT, onChange);
  };
}

function readStorage(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function parseManual(raw: string | null): ManualState {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ManualState;
  } catch {
    return {};
  }
}

export function OnboardingChecklist({
  autoCompleted,
}: {
  /** Étapes auto validées côté serveur */
  autoCompleted: Partial<Record<OnboardingStepId, boolean>>;
}) {
  // null côté serveur (et pendant l'hydratation), puis la valeur du localStorage.
  const raw = useSyncExternalStore(subscribeStorage, readStorage, () => null);
  const ready = raw !== null;
  const manual = parseManual(raw);

  function toggle(id: OnboardingStepId) {
    const next = { ...manual, [id]: !manual[id] };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* stockage indisponible */
    }
    window.dispatchEvent(new Event(LOCAL_EVENT));
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
