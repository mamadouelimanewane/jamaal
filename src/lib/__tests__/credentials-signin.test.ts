import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Le fournisseur « credentials » (src/lib/auth.ts) lit `credentials.login` (e-mail OU téléphone).
 * Un formulaire qui enverrait encore `email` échouerait pour TOUS les comptes, avec un simple
 * « mot de passe incorrect » : c'est arrivé sur /espace-revendeur, la page du menu du site
 * utilisée par les revendeurs sur smartphone. Ce test vérifie chaque appel du code source.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

test("chaque signIn(\"credentials\") transmet le champ « login » attendu par auth.ts", () => {
  const calls: { file: string; args: string }[] = [];
  for (const file of sourceFiles(path.resolve("src"))) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/signIn\(\s*["']credentials["']\s*,\s*\{([^}]*)\}/g)) calls.push({ file, args: m[1] });
  }
  assert.ok(calls.length >= 2, "les formulaires de connexion doivent être trouvés");
  for (const { file, args } of calls) {
    assert.match(args, /\blogin\b/, `${path.relative(process.cwd(), file)} : signIn("credentials") doit transmettre « login »`);
  }
});
