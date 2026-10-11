"use server";

import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { parseLoginIdentifier } from "@/lib/login-identifier";

export type RegisterState = { ok: boolean; error?: string };

/**
 * Inscription publique d'un compte client (espace /compte) : par e-mail ou par numéro de
 * téléphone, au choix. Si une fiche Customer existe déjà pour ce téléphone (créée lors d'une
 * commande invité), le compte s'y rattache pour retrouver son historique de commandes.
 */
export async function registerCustomer(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  // Piège à robots : un champ caché que seul un script remplit.
  if (String(formData.get("website") ?? "").trim()) return { ok: true };

  const h = await headers();
  const limited = await rateLimit(`register:${clientIpFromHeaders(h)}`, { limit: 5, windowMs: 10 * 60_000 });
  if (!limited.ok) return { ok: false, error: `Trop de tentatives. Réessayez dans ${limited.retryAfterSec} s.` };

  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const loginRaw = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (name.length < 2) return { ok: false, error: "Indiquez votre nom." };
  const identifier = parseLoginIdentifier(loginRaw);
  if (!identifier) return { ok: false, error: "Indiquez un e-mail ou un numéro de téléphone valide." };
  if (password.length < 8) return { ok: false, error: "Mot de passe : 8 caractères au moins." };
  if (password !== confirm) return { ok: false, error: "Les deux mots de passe ne correspondent pas." };

  const email = identifier.kind === "email" ? identifier.value : null;
  const phone = identifier.kind === "phone" ? identifier.value : null;

  if (email && (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }))) {
    return { ok: false, error: "Un compte existe déjà avec cet e-mail." };
  }
  if (phone && (await prisma.user.findUnique({ where: { phone }, select: { id: true } }))) {
    return { ok: false, error: "Un compte existe déjà avec ce numéro de téléphone." };
  }

  // Une commande invité passée avec ce téléphone a peut-être déjà créé une fiche client : on s'y
  // rattache pour que l'historique de commandes apparaisse tout de suite. Sans téléphone (compte
  // créé par e-mail seul), aucune fiche n'est créée : Customer.phone est obligatoire et unique, et
  // on ne fabrique pas de faux numéro. Le rattachement se fera lors d'une future commande.
  const customerId = phone
    ? (await prisma.customer.upsert({ where: { phone }, update: { name }, create: { name, phone, email } })).id
    : null;

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name, email, phone, passwordHash, role: "CLIENT", customerId },
  });

  try {
    await signIn("credentials", { login: loginRaw, password, redirectTo: "/compte" });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: "Compte créé, mais la connexion automatique a échoué. Réessayez de vous connecter." };
    throw error;
  }
  return { ok: true };
}

export type LoginState = { ok: boolean; error?: string };

/** Connexion publique d'un compte client (espace /compte). */
export async function loginCustomer(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", { login, password, redirectTo: "/compte" });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: "Identifiant (e-mail ou téléphone) ou mot de passe incorrect." };
    throw error;
  }
  return { ok: true };
}
