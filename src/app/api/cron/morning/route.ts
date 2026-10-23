import { sendMorningKit } from "@/lib/automation/morning-kit";
import { watchChoganPrices } from "@/lib/automation/chogan-watch";
import { claimAutomation } from "@/lib/automation-settings";
import { siteBaseUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Kit du matin des revendeurs (cron Vercel, 8 h à Dakar). Même protection que la tâche du soir. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Accès refusé.", { status: 401 });
  } else {
    if (!(req.headers.get("user-agent") ?? "").startsWith("vercel-cron")) return new Response("Accès refusé.", { status: 401 });
    if (!(await claimAutomation(`cron-matin:${new Date().toISOString().slice(0, 10)}`))) return Response.json({ ok: true, deja: true });
  }
  try {
    const started = Date.now();
    const kit = await sendMorningKit(siteBaseUrl());
    // Le temps restant sert à la mise à jour du catalogue Chogan (prix et nouveautés).
    const chogan = await watchChoganPrices(Math.max(5_000, 52_000 - (Date.now() - started))).catch((e) => ({ erreur: String(e) }));
    return Response.json({ ok: true, report: kit, chogan });
  } catch (e) {
    console.error("[kit du matin]", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
