import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      /** Identifiant de connexion s'il s'agit d'un numéro de téléphone (compte sans e-mail). */
      phone?: string | null;
      /** Connexion par lien WhatsApp (sans mot de passe) : horodatage, pour choisir un mot de passe. */
      magicAt?: number | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    phone?: string | null;
    via?: "magic";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    phone?: string | null;
    magicAt?: number | null;
  }
}
