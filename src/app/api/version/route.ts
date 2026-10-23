export const dynamic = "force-dynamic";

/**
 * Version en ligne : permet de vérifier que www.jamaal.sn, jamaal.sn et l'adresse Vercel servent bien la
 * même (dernière) version. Comparer « version » avec le dernier commit du dépôt.
 */
export function GET(req: Request) {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
  return Response.json(
    {
      version: sha.slice(0, 7),
      message: (process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "").split("\n")[0].slice(0, 120),
      environnement: process.env.VERCEL_ENV ?? "local",
      branche: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      adresse: new URL(req.url).host,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
