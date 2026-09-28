/**
 * Règles de fidélité JAMAAL
 * - 1 point pour 1000 FCFA dépensés (arrondi inférieur)
 * - Seuil d'échange : 50 points = 2500 FCFA de réduction (configurable)
 */

export const LOYALTY_FCFA_PER_POINT = 1000;
export const LOYALTY_REDEEM_MIN_POINTS = 50;
export const LOYALTY_REDEEM_VALUE_FCFA = 2500; // valeur d'un lot de 50 points

export function pointsEarnedFromAmount(amountFcfa: number): number {
  if (amountFcfa <= 0) return 0;
  return Math.floor(amountFcfa / LOYALTY_FCFA_PER_POINT);
}

export function canRedeem(points: number): boolean {
  return points >= LOYALTY_REDEEM_MIN_POINTS;
}

export function maxRedeemableLots(points: number): number {
  return Math.floor(points / LOYALTY_REDEEM_MIN_POINTS);
}

export function redeemValue(lots: number): number {
  return lots * LOYALTY_REDEEM_VALUE_FCFA;
}
