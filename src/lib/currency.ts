/** Les prix sont stockés en FCFA (nombres entiers), format d'affichage local Sénégal/UEMOA. */
export function formatPrice(n: number): string {
  return Math.round(n).toLocaleString("fr-FR") + " FCFA";
}
