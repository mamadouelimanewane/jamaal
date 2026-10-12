import { runDailyJobs } from "@/lib/automation/daily";
import { claimAutomation } from "@/lib/automation-settings";
import { siteBaseUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tâche quotidienne appelée par le cron Vercel (vercel.json). Avec CRON_SECRET défini dans
 * Vercel, seule une requête portant « Authorization: Bearer <CRON_SECRET> » est acceptée (Vercel
 * l'ajoute tout seul). Sans secret, seul l'agent du cron Vercel est accepté, une fois par jour.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Accès refusé.", { status: 401 });
  } else {
    if (!(req.headers.get("user-agent") ?? "").startsWith("vercel-cron")) return new Response("Accès refusé.", { status: 401 });
    if (!(await claimAutomation(`cron:${new Date().toISOString().slice(0, 10)}`))) return Response.json({ ok: true, deja: true });
  }
  const report = await runDailyJobs(siteBaseUrl());
  return Response.json({ ok: true, report });
}
