import { z } from "zod";

export const checkoutCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(120),
  phone: z
    .string()
    .trim()
    .min(8, "Numéro de téléphone invalide")
    .max(30)
    .regex(/^[+\d\s().-]+$/, "Numéro de téléphone invalide"),
  email: z
    .string()
    .trim()
    .email("E-mail invalide")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
});

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  volumeLabel: z.string().min(1),
  price: z.number().int().positive(),
  quantity: z.number().int().positive().max(50),
});

export const createOrderSchema = z.object({
  customer: checkoutCustomerSchema,
  items: z.array(checkoutItemSchema).min(1, "Le panier est vide"),
  consultantId: z.string().min(1).nullable().optional(),
  acceptCgv: z.literal(true, {
    message: "Vous devez accepter les Conditions Générales de Vente",
  }),
});

export type CheckoutCustomerInput = z.infer<typeof checkoutCustomerSchema>;
export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
