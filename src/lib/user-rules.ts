/**
 * Règles de gestion des comptes (pures, testées) : ce qu'un administrateur a le droit de faire à un compte.
 * Objectifs : ne jamais perdre le dernier administrateur complet, ne jamais s'enfermer dehors, et empêcher
 * toute escalade de privilèges.
 */

export const ROLES = ["ADMIN", "CONSULTANT", "LIVREUR", "CLIENT"] as const;
export type RoleName = (typeof ROLES)[number];

export const ROLE_LABEL: Record<RoleName, string> = {
  ADMIN: "Administrateur",
  CONSULTANT: "Consultant (revendeur)",
  LIVREUR: "Livreur",
  CLIENT: "Client",
};

export const isRoleName = (v: unknown): v is RoleName => typeof v === "string" && (ROLES as readonly string[]).includes(v);

export interface TargetUser {
  id: string;
  role: string;
  active: boolean;
  profileId: string | null;
  consultantId: string | null;
  livreurId: string | null;
  customerId: string | null;
}

export type UserChange =
  | { kind: "delete" }
  | { kind: "suspend" }
  | { kind: "setRole"; role: RoleName; profileId: string | null };

/** Administrateur complet actif : rôle ADMIN, compte actif, aucun profil restreint. */
export const isFullAdmin = (u: Pick<TargetUser, "role" | "active" | "profileId">) => u.role === "ADMIN" && u.active && !u.profileId;

/**
 * Retourne un message d'erreur si le changement est interdit, sinon null.
 * `otherFullAdmins` = nombre d'autres administrateurs complets actifs (sans compter la cible).
 */
export function checkUserChange(actorId: string, target: TargetUser, change: UserChange, otherFullAdmins: number): string | null {
  const self = actorId === target.id;
  if (change.kind === "delete") {
    if (self) return "Vous ne pouvez pas supprimer votre propre compte.";
  } else if (change.kind === "suspend") {
    if (self) return "Vous ne pouvez pas suspendre votre propre compte.";
  } else {
    if (self) return "Vous ne pouvez pas modifier votre propre rôle ni vos propres privilèges (demandez à un autre administrateur).";
    if (change.role === "CONSULTANT" && !target.consultantId) return "Ce compte n'a pas de fiche revendeur : rattachez-en une avant de lui donner le rôle Consultant.";
    if (change.role === "LIVREUR" && !target.livreurId) return "Ce compte n'a pas de fiche livreur : rattachez-en une avant de lui donner le rôle Livreur.";
    if (change.role === "CLIENT" && !target.customerId) return "Ce compte n'a pas de fiche client : le rôle Client est réservé aux comptes de clients.";
    if (change.role !== "ADMIN" && change.profileId) return "Un profil de privilèges ne s'applique qu'aux administrateurs.";
  }
  // Le dernier administrateur complet ne peut être ni supprimé, ni suspendu, ni rétrogradé, ni restreint.
  if (isFullAdmin(target) && otherFullAdmins === 0) {
    const losesFullAccess = change.kind === "delete" || change.kind === "suspend" || (change.kind === "setRole" && (change.role !== "ADMIN" || !!change.profileId));
    if (losesFullAccess) return "Il doit rester au moins un administrateur complet actif : promouvez ou créez-en un autre d'abord.";
  }
  return null;
}

/** Mot de passe accepté : 8 caractères au moins, avec une lettre et un chiffre. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Mot de passe : 8 caractères au moins.";
  if (password.length > 200) return "Mot de passe trop long.";
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return "Mot de passe : au moins une lettre et un chiffre.";
  return null;
}
