import { prisma } from "@/lib/prisma";

/**
 * Rattache une commande passée à une fiche client (déduplication par téléphone).
 * Fonction interne, volontairement hors d'un fichier « use server » : elle n'est appelée que
 * par createOrder et createConsultantOrder et ne doit jamais être invocable depuis le navigateur.
 */
export async function upsertCustomerFromOrder(input: {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
}) {
  const phone = input.phone.trim();
  if (!phone) return null;
  const customer = await prisma.customer.upsert({
    where: { phone },
    update: {
      name: input.name,
      email: input.email || undefined,
      address: input.address || undefined,
    },
    create: {
      name: input.name,
      phone,
      email: input.email || null,
      address: input.address || null,
    },
  });
  return customer.id;
}
