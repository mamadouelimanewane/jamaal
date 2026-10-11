import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      /** Identifiant de connexion s'il s'agit d'un numéro de téléphone (compte sans e-mail). */
      phone?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    phone?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    phone?: string | null;
  }
}
