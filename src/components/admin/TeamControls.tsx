"use client";

import { useActionState, useState, useTransition } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { addTeamMemberAction, removeTeamMemberAction, setRankAction, type TeamActionResult } from "@/lib/actions/team";

const initial: TeamActionResult = { ok: false };

/** Rattacher un membre libre avec son code. */
export function AddMemberForm({ recruitTitle }: { recruitTitle: string }) {
  const [state, action, pending] = useActionState(addTeamMemberAction, initial);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-xs font-medium text-navy/85">
        Code du membre (son identifiant JAMAAL)
        <input name="code" required placeholder="ex. awa-diop" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy" />
      </label>
      <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
        <UserPlus size={15} /> {pending ? "Ajout…" : `Ajouter comme ${recruitTitle}`}
      </button>
      {state.message && <p role="status" className="w-full text-sm text-emerald-800">{state.message}</p>}
      {state.error && <p role="alert" className="w-full text-sm text-rose-dark">{state.error}</p>}
    </form>
  );
}

/** Retirer un membre de son équipe (il devient libre). */
export function RemoveMemberButton({ memberId, name }: { memberId: string; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<TeamActionResult | null>(null);
  if (res?.ok) return <span className="text-xs text-emerald-800">Retiré</span>;
  return confirm ? (
    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
      <span className="text-xs text-navy/80">Retirer {name} ?</span>
      <button type="button" disabled={pending} onClick={() => start(async () => setRes(await removeTeamMemberAction(memberId)))} className="rounded-full bg-red-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60">Oui</button>
      <button type="button" onClick={() => setConfirm(false)} className="px-1.5 text-xs text-navy/70">Non</button>
      {res?.error && <span role="alert" className="w-full text-right text-xs text-rose-dark">{res.error}</span>}
    </span>
  ) : (
    <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline"><UserMinus size={13} /> Retirer</button>
  );
}

/** Admin : changer le rang d'un membre. */
export function RankForm({ consultantId, current }: { consultantId: string; current: string }) {
  const [state, action, pending] = useActionState(setRankAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="consultantId" value={consultantId} />
      {(["LEADER", "PARRAIN", "CONSULTANT"] as const).map((r) => (
        <button
          key={r}
          name="rank"
          value={r}
          disabled={pending || current === r}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${current === r ? "bg-navy text-white" : "border border-navy text-navy hover:bg-navy/5"} disabled:opacity-100`}
        >
          {current === r ? "✓ " : r === "CONSULTANT" ? "Repasser " : "Promouvoir "}
          {r === "LEADER" ? "Leader" : r === "PARRAIN" ? "Parrain" : "Consultant"}
        </button>
      ))}
      {state.message && <p role="status" className="w-full text-sm text-emerald-800">{state.message}</p>}
      {state.error && <p role="alert" className="w-full text-sm text-rose-dark">{state.error}</p>}
    </form>
  );
}
