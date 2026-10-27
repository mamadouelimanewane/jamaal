import { prisma } from "@/lib/prisma";

type Job = "daily" | "morning";
const runKey = (job: Job, startedAt: Date) => `automation_run_${startedAt.getTime().toString().padStart(13, "0")}_${job}`;

export interface AutomationRunRecord {
  job: Job;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: "OK" | "PARTIEL" | "ECHEC";
  steps: { name: string; status: "OK" | "ECHEC"; detail: string }[];
}

function summarize(report: Record<string, unknown>, fatalError?: unknown): AutomationRunRecord["steps"] {
  return Object.entries({ ...report, ...(fatalError ? { erreurGlobale: fatalError } : {}) })
    .filter(([name]) => name !== "dureeMs")
    .map(([name, value]) => {
      const error = value && typeof value === "object" && "erreur" in value
        ? String((value as { erreur: unknown }).erreur)
        : fatalError && name === "erreurGlobale" ? String(value) : "";
      const detail = error || (typeof value === "string" ? value : JSON.stringify(value));
      return { name, status: error ? "ECHEC" as const : "OK" as const, detail: (detail || "Terminé").slice(0, 240) };
    });
}

export async function recordAutomationRun(job: Job, started: Date, report: Record<string, unknown>, fatalError?: unknown) {
  const steps = summarize(report, fatalError);
  const failed = steps.filter((step) => step.status === "ECHEC").length;
  const record: AutomationRunRecord = {
    job,
    startedAt: started.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - started.getTime(),
    status: fatalError || (steps.length > 0 && failed === steps.length) ? "ECHEC" : failed ? "PARTIEL" : "OK",
    steps,
  };
  try {
    await prisma.setting.upsert({
      where: { key: runKey(job, started) },
      create: { key: runKey(job, started), value: JSON.stringify(record) },
      update: { value: JSON.stringify(record) },
    });
  } catch (error) {
    console.error(`[automation] journal ${job} non enregistré`, error);
  }
  return record;
}

export async function latestAutomationRuns(): Promise<AutomationRunRecord[]> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: "automation_run_" } }, orderBy: { key: "desc" }, take: 12 });
  return rows.flatMap((row) => {
    try {
      const parsed = JSON.parse(row.value) as AutomationRunRecord;
      return parsed && parsed.job && parsed.startedAt && Array.isArray(parsed.steps) ? [parsed] : [];
    } catch {
      return [];
    }
  }).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
