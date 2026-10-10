import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";

/** Justificatif d'une dépense (photo ou PDF) : réservé aux administrateurs. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;
  const { id } = await params;
  const e = await prisma.expense.findUnique({ where: { id }, select: { receipt: true, receiptMime: true, receiptName: true } });
  if (!e?.receipt) return new Response("Introuvable", { status: 404 });
  const name = (e.receiptName ?? "justificatif").replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(e.receipt), {
    headers: {
      "Content-Type": e.receiptMime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
