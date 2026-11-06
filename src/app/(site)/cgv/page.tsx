import { getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { getAccountingSettings } from "@/lib/accounting/ledger";
import { getBusinessModel } from "@/lib/business-model-store";
import { getReservationSettings } from "@/lib/reservation-store";
import { getInstallmentSettings } from "@/lib/installments-store";
import { subscriptionDiscountPct } from "@/lib/subscriptions/run";
import { REMIND_DAYS_BEFORE } from "@/lib/subscriptions/plan";
import { GIFT_VALIDITY_DAYS } from "@/lib/gift/gift";
import { LOYALTY_FCFA_PER_POINT, LOYALTY_REDEEM_MIN_POINTS, LOYALTY_REDEEM_VALUE_FCFA } from "@/lib/loyalty";
import { UNPAID_CANCEL_DAYS } from "@/lib/installments";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
  title: t("Conditions générales de vente"),
  description: t("Conditions générales de vente de JAMAAL : commande, prix, paiement, paiement en plusieurs fois, livraison, retours et remboursements."),
};
}
export const revalidate = 3600;

/** Date de la dernière mise à jour du texte (à changer à chaque modification des conditions). */
const UPDATED = "29 octobre 2026";

const F = (n: number) => `${n.toLocaleString("fr-FR")} F CFA`;

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-24 font-serif-display text-xl font-semibold text-navy">
      {children}
    </h2>
  );
}

/**
 * Conditions générales de vente. Les montants et délais sont lus dans les réglages du site
 * (modèle économique, réservations, paiement en plusieurs fois, abonnements, comptabilité) :
 * le texte reste toujours conforme à ce que le site applique réellement.
 */
export default async function CgvPage() {
  const t = await getT();
  const [acc, model, resa, inst, subPct] = await Promise.all([
    getAccountingSettings().catch(() => null),
    getBusinessModel(),
    getReservationSettings(),
    getInstallmentSettings(),
    subscriptionDiscountPct().catch(() => 5),
  ]);
  const company = acc?.company;
  const payments = [
    model.acceptWave && "Wave",
    model.acceptOrangeMoney && "Orange Money",
    model.acceptCard && "carte bancaire",
    model.acceptCashOnDelivery && "paiement en espèces à la livraison ou au retrait",
  ].filter(Boolean) as string[];

  const sections = [
    ["objet", "Objet"],
    ["vendeur", "Vendeur"],
    ["produits", "Produits"],
    ["prix", "Prix"],
    ["commande", "Commande"],
    ["conseillers", "Conseillers JAMAAL"],
    ["paiement", "Paiement"],
    ["plusieurs-fois", "Paiement en plusieurs fois"],
    ["reservation", "Réservation"],
    ["livraison", "Livraison et retrait"],
    ["reception", "Réception et réclamations"],
    ["retours", "Retours, échanges et remboursements"],
    ["annulation", "Annulation"],
    ["cadeaux", "Cartes cadeaux, fidélité et réassort"],
    ["usage", "Bon usage des produits"],
    ["donnees", "Données personnelles et messages WhatsApp"],
    ["litiges", "Droit applicable et litiges"],
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 text-[15px] leading-relaxed text-navy/85 sm:px-6">
      <h1 className="font-serif-display text-3xl font-semibold text-navy">{t("Conditions générales de vente")}</h1>
      <p className="mt-2 text-sm text-navy/60">{t("Dernière mise à jour :")} {UPDATED}</p>

      <nav aria-label={t("Sommaire")} className="mt-8 rounded-2xl border border-line bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy/60">{t("Sommaire")}</p>
        <ol className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {sections.map(([id, label], i) => (
            <li key={id}>
              <a href={`#${id}`} className="text-navy hover:underline">{i + 1}. {t(label)}</a>
            </li>
          ))}
        </ol>
      </nav>

      <H id="objet">{t("1. Objet")}</H>
      <p className="mt-3">
        {t("Les présentes conditions générales de vente (« CGV ») s'appliquent à toute commande de produits passée auprès de JAMAAL : sur le site, sur WhatsApp, par l'intermédiaire d'un conseiller JAMAAL ou depuis la boutique personnelle d'un conseiller. Toute commande vaut acceptation des CGV en vigueur au jour de la commande. Le client déclare être majeur et capable de contracter.")}
      </p>

      <H id="vendeur">{t("2. Vendeur")}</H>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>{company?.name || "JAMAAL"}</li>
        {company?.address && <li>{t("Adresse :")} {company.address}</li>}
        {company?.ninea && <li>{t("NINEA :")} {company.ninea}</li>}
        {company?.rccm && <li>{t("RCCM :")} {company.rccm}</li>}
        <li>
          {t("Contact : sur WhatsApp (")}{WHATSAPP_CONTACTS.map((c, i) => (
            <span key={c.number}>
              {i > 0 && t(" ou ")}
              <a href={whatsappLink(c.number)} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-dark underline">{c.display}</a>
            </span>
          ))}{t(") ou par la page")} <Link href="/contact" className="font-semibold text-rose-dark underline">{t("Contact")}</Link>.
        </li>
      </ul>
      <p className="mt-3">{t("JAMAAL distribue au Sénégal des parfums et produits de soin de la marque Chogan (Italie).")}</p>

      <H id="produits">{t("3. Produits")}</H>
      <p className="mt-3">
        {t("Les produits sont décrits avec le plus grand soin. Les photos, couleurs et flacons sont présentés à titre indicatif et peuvent légèrement différer du produit livré (conditionnement, série). Chaque fiche indique les formats proposés et, lorsqu'elle est disponible, la composition.")}
      </p>
      <p className="mt-3">
        {t("Lorsqu'une fiche indique qu'un parfum est « inspiré de » un parfum d'une autre marque, cette mention sert uniquement à décrire sa famille olfactive. Les produits vendus sont des créations Chogan : ni JAMAAL ni Chogan ne sont liés aux marques citées, qui restent la propriété de leurs titulaires.")}
      </p>
      <p className="mt-3">{t("Les produits sont proposés dans la limite des stocks disponibles. Un format en rupture peut être réservé (article 9).")}</p>

      <H id="prix">{t("4. Prix")}</H>
      <p className="mt-3">
        {t("Les prix sont indiqués en francs CFA (F CFA), toutes taxes comprises. Les frais de livraison, s'il y en a, sont ajoutés et affichés avant la validation de la commande. Le prix applicable est celui affiché au moment de la commande. Les remises (codes promo, offres, points de fidélité, remise abonné) ne se cumulent que lorsque le panier l'indique.")}
      </p>

      <H id="commande">{t("5. Commande")}</H>
      <p className="mt-3">
        {t("Sur le site, le client choisit ses produits, indique ses coordonnées et le mode de livraison ou de retrait, vérifie le récapitulatif (produits, frais, total), accepte les CGV puis valide. La commande reçoit un numéro et une page de suivi ; une confirmation est envoyée sur WhatsApp lorsque le client a donné son numéro.")}
      </p>
      <p className="mt-3">
        {t("JAMAAL peut refuser ou annuler une commande en cas d'anomalie (prix manifestement erroné, coordonnées invalides, suspicion de fraude, rupture constatée après commande). Le client est alors prévenu et, s'il a déjà payé, intégralement remboursé.")}
      </p>

      <H id="conseillers">{t("6. Conseillers JAMAAL")}</H>
      <p className="mt-3">
        {t("Les conseillers JAMAAL sont des revendeurs indépendants agréés. Une commande passée par un conseiller, depuis sa boutique personnelle ou avec son lien, est une commande JAMAAL soumise aux présentes CGV : mêmes produits, mêmes prix officiels, mêmes garanties. Le conseiller peut envoyer au client un lien de paiement personnel ; ce lien mène à la page de la commande sur le site JAMAAL.")}
      </p>

      <H id="paiement">{t("7. Paiement")}</H>
      <p className="mt-3">
        {t("Moyens de paiement acceptés :")} {payments.length ? payments.join(", ") : t("indiqués au moment de la commande")}{t(". Le paiement en ligne se fait sur l'interface du prestataire (Wave, Orange Money…) : JAMAAL n'a jamais accès à vos codes. Un paiement n'est considéré comme reçu qu'après confirmation par le prestataire.")}
      </p>
      <p className="mt-3">
        {t("Une commande à payer en ligne qui n'a reçu aucun paiement reçoit un rappel, puis est annulée au bout de")} {UNPAID_CANCEL_DAYS} {t("jours ; les produits sont alors remis en vente.")}
      </p>

      <H id="plusieurs-fois">{t("8. Paiement en plusieurs fois")}</H>
      {inst.enabled ? (
        <>
          <p className="mt-3">
            {t("Pour une commande d'au moins")} {F(inst.minTotal)} {t("(livraison comprise), le client peut payer en")} {inst.maxParts === 3 ? t("2 ou 3") : "2"} {t("fois, sans frais. La première échéance est payée à la commande, les suivantes tous les")} {inst.intervalDays} {t("jours. Les montants et les dates figurent sur la page de la commande avant chaque paiement.")}
          </p>
          <p className="mt-3">
            {t("Les échéances se paient en ligne (Wave ou Orange Money), avec un rappel sur WhatsApp deux jours avant et le jour de chaque échéance. Les produits sont mis de côté dès la première échéance ; la commande est préparée et livrée (ou remise) une fois entièrement payée.")}
          </p>
          <p className="mt-3">
            {t("En cas de retard, JAMAAL ou le conseiller contacte le client. Si le client renonce à sa commande, les échéances déjà payées lui sont remboursées par le moyen de paiement utilisé.")}
          </p>
        </>
      ) : (
        <p className="mt-3">{t("Le paiement en plusieurs fois n'est pas proposé pour le moment.")}</p>
      )}

      <H id="reservation">{t("9. Réservation")}</H>
      {resa.enabled ? (
        <p className="mt-3">
          {t("Un format en rupture de stock peut être réservé : le client paie un acompte de")} {resa.depositPercent} {t("% du prix des produits, JAMAAL commande le produit (délai indicatif :")} {resa.delayLabel}{t(") et prévient le client à son arrivée ; le solde se règle alors en ligne, à la livraison ou au retrait.")}
          {resa.refundable
            ? t(" Si le client annule avant l'arrivée du produit, l'acompte lui est remboursé.")
            : t(" L'acompte n'est pas remboursé si le client annule après la réservation.")}{" "}
          {t("Si le produit ne peut finalement pas être obtenu, l'acompte est intégralement remboursé.")}
        </p>
      ) : (
        <p className="mt-3">{t("La réservation des produits en rupture n'est pas proposée pour le moment.")}</p>
      )}

      <H id="livraison">{t("10. Livraison et retrait")}</H>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <strong>{t("Livraison à domicile par JAMAAL")}</strong>
          {model.deliveryMaxKm > 0 ? t(" jusqu'à {deliveryMaxKm} km de notre dépôt", { deliveryMaxKm: model.deliveryMaxKm }) : ""} : {F(model.deliveryBaseFee)}
          {model.deliveryPerKm > 0 ? t(" pour les {deliveryIncludedKm} premiers km, puis {v1} par km", { deliveryIncludedKm: model.deliveryIncludedKm, v1: F(model.deliveryPerKm) }) : ""}.
          {model.deliveryFreeAbove > 0 ? t(" La livraison est offerte à partir de {v0} de produits.", { v0: F(model.deliveryFreeAbove) }) : ""} {t("Les frais exacts sont calculés selon l'adresse et affichés avant la validation.")}
        </li>
        <li><strong>{t("Retrait chez votre conseiller")}</strong>{t(", sans frais.")}</li>
        <li>{t("Au-delà de la zone de livraison, contactez-nous sur WhatsApp : nous cherchons avec vous la meilleure solution d'envoi.")}</li>
      </ul>
      <p className="mt-3">
        {t("Le délai de livraison est indiqué à la confirmation de la commande ; le client peut suivre son colis en direct depuis le lien de suivi. Le livreur remet le colis contre le code de remise communiqué au client (ou au destinataire désigné). Le client veille à être joignable au numéro indiqué.")}
      </p>

      <H id="reception">{t("11. Réception et réclamations")}</H>
      <p className="mt-3">
        {t("À la réception, le client vérifie que le colis est complet et que les flacons sont intacts et scellés. Tout produit manquant, cassé ou non conforme doit être signalé dans les 48 heures suivant la réception, sur WhatsApp, avec le numéro de commande et une photo. JAMAAL remplace alors le produit ou le rembourse.")}
      </p>

      <H id="retours">{t("12. Retours, échanges et remboursements")}</H>
      <p className="mt-3">
        {t("Pour des raisons d'hygiène, un parfum ou un soin ouvert, descellé ou entamé ne peut être ni repris ni échangé, sauf défaut. Un produit non ouvert, dans son emballage d'origine scellé, peut être retourné ou échangé dans les 7 jours suivant sa réception : il suffit de nous prévenir sur WhatsApp. Le retour se fait chez votre conseiller ou au dépôt JAMAAL ; les frais de retour sont à la charge du client, sauf produit défectueux ou erreur de notre part.")}
      </p>
      <p className="mt-3">
        {t("Le remboursement est fait après réception et vérification du produit, par le moyen de paiement utilisé (ou en espèces pour un paiement à la livraison), dans un délai de 14 jours. Les frais de livraison initiaux ne sont remboursés qu'en cas de produit défectueux, non conforme ou d'erreur de notre part.")}
      </p>

      <H id="annulation">{t("13. Annulation")}</H>
      <p className="mt-3">
        {t("Le client peut annuler sa commande sans frais tant qu'elle n'a pas été remise au livreur, en nous contactant sur WhatsApp ; les sommes déjà payées sont intégralement remboursées. Une commande déjà expédiée suit les règles de retour (article 12).")}
      </p>

      <H id="cadeaux">{t("14. Cartes cadeaux, fidélité et réassort")}</H>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <strong>{t("Cartes cadeaux")}</strong> {t(": valables")} {Math.round(GIFT_VALIDITY_DAYS / 30)} {t("mois à compter de l'achat, utilisables en une ou plusieurs fois sur le site, dans la limite de leur solde. Elles ne sont ni remboursables ni échangeables contre des espèces.")}
        </li>
        <li>
          <strong>{t("Fidélité")}</strong> {t(": 1 point par tranche de")} {F(LOYALTY_FCFA_PER_POINT)} {t("payée ;")} {LOYALTY_REDEEM_MIN_POINTS} {t("points donnent une réduction de")} {F(LOYALTY_REDEEM_VALUE_FCFA)} {t("sur une prochaine commande. Les points n'ont pas de valeur en espèces.")}
        </li>
        <li>
          <strong>{t("Réassort automatique")}</strong> {t(": le client choisit ses produits et un rythme, et bénéficie de")} {subPct} {t("% de remise sur ces produits. Il reçoit un rappel")} {REMIND_DAYS_BEFORE} {t("jours avant chaque commande, qu'il paie en un clic ; il peut mettre en pause ou arrêter le réassort à tout moment, sans frais.")}
        </li>
      </ul>

      <H id="usage">{t("15. Bon usage des produits")}</H>
      <p className="mt-3">
        {t("Les produits sont destinés à un usage externe. Respectez les indications portées sur l'emballage, faites un essai sur une petite zone de peau en cas de peau sensible ou d'allergie connue, évitez le contact avec les yeux et tenez les produits hors de portée des enfants et à l'abri de la chaleur. Les conseils donnés par JAMAAL et ses conseillers ne remplacent pas l'avis d'un professionnel de santé.")}
      </p>

      <H id="donnees">{t("16. Données personnelles et messages WhatsApp")}</H>
      <p className="mt-3">
        {t("Les informations demandées (nom, téléphone, adresse) servent à traiter la commande, à la livrer, à en assurer le suivi et le service client. Elles sont partagées uniquement avec les personnes qui en ont besoin (votre conseiller, le livreur, le prestataire de paiement) et ne sont jamais vendues. Conformément à la loi n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel, le client peut demander l'accès, la rectification ou la suppression de ses données en nous écrivant sur WhatsApp.")}
      </p>
      <p className="mt-3">
        {t("Le client reçoit sur WhatsApp les messages liés à ses commandes (confirmation, paiement, livraison, rappels d'échéance) et, le cas échéant, quelques messages de suivi. Il peut ne plus recevoir les messages non indispensables en répondant STOP.")}
      </p>

      <H id="litiges">{t("17. Droit applicable et litiges")}</H>
      <p className="mt-3">
        {t("Les présentes CGV sont régies par le droit sénégalais. En cas de difficulté, le client est invité à contacter d'abord JAMAAL sur WhatsApp afin de trouver une solution amiable. À défaut d'accord, le litige sera porté devant les juridictions compétentes de Dakar.")}
      </p>
      <p className="mt-3">
        {t("JAMAAL peut modifier les présentes CGV ; la version applicable est celle en vigueur à la date de la commande.")}
      </p>
    </div>
  );
}
