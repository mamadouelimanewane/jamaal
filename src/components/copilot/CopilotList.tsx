"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, MessageCircle, Pencil } from "lucide-react";
import { actionLink, type CopilotAction } from "@/lib/copilot/plan";

/** Les actions du jour : message prêt (modifiable), « Envoyer sur WhatsApp », coche « Fait » (mémorisée sur ce téléphone). */
export function CopilotList({ actions, day }: { actions: CopilotAction[]; day: string }) {
  const storeKey = `jamaal_copilote_${day}`;
  const [done, setDone] = useState<string[]>([]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    let saved: string[] = [];
    try {
      saved = JSON.parse(localStorage.getItem(storeKey) ?? "[]");
    } catch {
      // stockage indisponible
    }
    queueMicrotask(() => setDone(Array.isArray(saved) ? saved : []));
  }, [storeKey]);

  const mark = (key: string, on = true) => {
    const next = on ? [...new Set([...done, key])] : done.filter((k) => k !== key);
    setDone(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {
      // sans stockage : pour cette page seulement
    }
  };

  const count = actions.filter((a) => done.includes(a.key)).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${actions.length ? (count / actions.length) * 100 : 0}%` }} />
        </div>
        <span className="shrink-0 text-sm font-semibold text-navy">{count} / {actions.length} faites</span>
      </div>
      {count === actions.length && actions.length > 0 && <p className="rounded-2xl bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-900">🎉 Bravo, toutes vos actions du jour sont faites !</p>}
      <ol className="space-y-3">
        {actions.map((a, i) => {
          const isDone = done.includes(a.key);
          const text = texts[a.key] ?? a.message;
          return (
            <li key={a.key} className={`rounded-2xl border bg-white p-4 ${isDone ? "border-emerald-200 opacity-70" : "border-line"}`}>
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => mark(a.key, !isDone)} aria-label={isDone ? "Marquer comme à faire" : "Marquer comme fait"} className="mt-0.5 shrink-0 text-emerald-600">
                  {isDone ? <CheckCircle2 size={24} /> : <Circle size={24} className="text-navy/30" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy"><span className="text-navy/50">{i + 1}.</span> {a.title}</p>
                  <p className="text-sm text-navy/70">{a.detail}</p>
                  {editing === a.key ? (
                    <textarea value={text} onChange={(e) => setTexts({ ...texts, [a.key]: e.target.value })} rows={5} className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm" />
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap rounded-xl bg-[#d9fdd3] px-3 py-2 text-sm text-navy">{text}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={actionLink({ phone: a.phone, message: text })} target="_blank" rel="noopener noreferrer" onClick={() => mark(a.key)} className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                      <MessageCircle size={16} /> {a.phone ? "Envoyer sur WhatsApp" : "Partager sur WhatsApp"}
                    </a>
                    {a.type === "statut" && <Link href="/admin/mon-marketing#partager" className="inline-flex items-center rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream">Visuel du jour</Link>}
                    <button type="button" onClick={() => setEditing(editing === a.key ? null : a.key)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-navy/70 hover:text-navy">
                      <Pencil size={14} /> {editing === a.key ? "Terminer" : "Modifier"}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
