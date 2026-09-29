import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getConsultantRank } from "@/lib/ranking";
import { getConsultantCommission } from "@/lib/commission";
import { requireAdminForApi } from "@/lib/api-guard";

interface TreeNode {
  id: string;
  name: string;
  city: string;
  monthlyRevenue: number;
  rank: string;
  children: TreeNode[];
}

async function buildTree(consultantId: string, depth = 0, ancestors = new Set<string>()): Promise<TreeNode | null> {
  if (ancestors.has(consultantId)) return null;
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(consultantId);

  const consultant = await prisma.consultant.findUnique({
    where: { id: consultantId },
    select: { id: true, name: true, city: true, sponsored: { select: { id: true } } },
  });
  if (!consultant) return null;

  const [rankInfo, commission] = await Promise.all([
    getConsultantRank(consultantId),
    getConsultantCommission(consultantId),
  ]);
  const children = depth < 3
    ? (await Promise.all(consultant.sponsored.map((s) => buildTree(s.id, depth + 1, nextAncestors))))
        .filter((child): child is TreeNode => child !== null)
    : [];

  return {
    id: consultant.id,
    name: consultant.name,
    city: consultant.city,
    monthlyRevenue: commission.monthlyRevenue,
    rank: rankInfo.rank ?? "STARTER",
    children,
  };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  const { id } = await params;
  const tree = await buildTree(id);
  if (!tree) return NextResponse.json({ error: "Consultant introuvable" }, { status: 404 });
  return NextResponse.json(tree);
}
