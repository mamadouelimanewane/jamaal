/**
 * Clôture des défis terminés : chaque revendeur qui a atteint l'objectif reçoit le bonus sur son
 * wallet (une seule fois, grâce à la référence unique du mouvement) et un message WhatsApp.
 */
import { prisma } from "@/lib/prisma";
import { challengeStandings } from "@/lib/challenges";
import { notifyResellerWhatsApp } from "@/lib/whatsapp";

export async function awardChallenges(now = new Date()) {
  const done = await prisma.challenge.findMany({ where: { active: true, awardedAt: null, endsAt: { lt: now } } });
  const report: Record<string, number> = {};
  for (const ch of done) {
    const winners = (await challengeStandings(ch)).filter((s) => s.reached);
    let paid = 0;
    for (const w of winners) {
      if (ch.bonus <= 0) break;
      try {
        await prisma.walletTransaction.create({
          data: { ownerType: "CONSULTANT", ownerId: w.consultantId, amount: ch.bonus, kind: "PRIME", status: "VALIDE", sourceId: `defi:${ch.id}:${w.consultantId}`, note: `Défi réussi : ${ch.title}`.slice(0, 200) },
        });
        paid++;
        notifyResellerWhatsApp(w.consultantId, `Bravo ${w.name.split(/\s+/)[0]} ! 🏆 Défi « ${ch.title} » réussi : ${ch.bonus.toLocaleString("fr-FR")} FCFA ajoutés à votre wallet JAMAAL.`);
      } catch {
        // déjà versé (référence unique)
      }
    }
    await prisma.challenge.update({ where: { id: ch.id }, data: { awardedAt: now } });
    report[ch.title] = paid;
  }
  return report;
}
