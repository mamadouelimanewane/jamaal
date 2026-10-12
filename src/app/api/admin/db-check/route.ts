import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/db-check : tables et colonnes prévues par le schéma mais absentes de la base
 * (une migration non appliquée casse les pages qui les utilisent). Lecture seule.
 */
export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;
  const rows = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`;
  const have = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!have.has(r.table_name)) have.set(r.table_name, new Set());
    have.get(r.table_name)!.add(r.column_name);
  }
  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  for (const m of Prisma.dmmf.datamodel.models) {
    const table = m.dbName ?? m.name;
    const cols = have.get(table);
    if (!cols) {
      missingTables.push(table);
      continue;
    }
    for (const f of m.fields) {
      if (f.kind !== "scalar" && f.kind !== "enum") continue;
      const col = f.dbName ?? f.name;
      if (!cols.has(col)) missingColumns.push(`${table}.${col}`);
    }
  }
  return Response.json({ ok: !missingTables.length && !missingColumns.length, missingTables, missingColumns });
}
