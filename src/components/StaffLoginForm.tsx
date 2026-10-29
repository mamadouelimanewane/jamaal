import Link from "next/link";
import { passwordLogin, whatsappLoginLink } from "@/lib/actions/staff-login";
import { WHATSAPP_CONTACTS } from "@/lib/contact";

const field = "mt-2 w-full rounded-xl border border-line bg-cream/50 px-4 py-3 text-base outline-none transition focus:border-rose-dark focus:bg-white focus:ring-4 focus:ring-rose/10";

export interface LoginNotice {
  erreur?: string;
  lien?: string;
  reset?: string;
  id?: string;
  /** Compte suspendu ou droits modifiés : la session a été coupée. */
  suspendu?: string;
  session?: string;
}

/**
 * Connexion de l'équipe (revendeurs, livreurs, admins), commune à /admin/login et à
 * /espace-revendeur : numéro WhatsApp ou e-mail + mot de passe, OU lien de connexion reçu sur
 * WhatsApp (sans mot de passe). Messages explicites à chaque échec.
 */
export function StaffLoginForm({ from, next, notice }: { from: "/admin/login" | "/espace-revendeur" | "/admin/livreur"; next?: string; notice: LoginNotice }) {
  const id = (notice.id ?? "").slice(0, 80);
  const help = `https://wa.me/${WHATSAPP_CONTACTS[0].number}?text=${encodeURIComponent(`Bonjour JAMAAL, je n'arrive pas à me connecter à mon espace revendeur.${id ? ` Mon numéro / identifiant : ${id}` : ""}`)}`;
  const msg =
    notice.suspendu
      ? { tone: "err", text: "Votre compte est suspendu. Contactez l'administrateur JAMAAL pour le réactiver." }
      : notice.session
        ? { tone: "err", text: "Vos droits ont changé : reconnectez-vous pour les appliquer." }
        : notice.erreur === "pas-livreur"
      ? { tone: "err", text: "Ce numéro n'a pas encore de compte livreur (votre compte revendeur reste à part). Inscrivez-vous avec l'onglet « Je m'inscris » : l'équipe JAMAAL validera votre compte livreur." }
        : notice.erreur === "attente"
      ? { tone: "ok", text: "Votre inscription de livreur est en cours de validation par l'équipe JAMAAL. Vous serez prévenu sur WhatsApp dès qu'elle est acceptée." }
        : notice.erreur === "bloque"
      ? { tone: "err", text: "Trop d'essais : par sécurité, la connexion par mot de passe est bloquée 15 minutes pour ce compte. Pas besoin d'attendre : recevez un lien de connexion sur WhatsApp ci-dessous." }
      : notice.erreur
        ? { tone: "err", text: "Numéro (ou e-mail) ou mot de passe incorrect. Revendeurs et livreurs : tapez votre numéro WhatsApp, par exemple 77 123 45 67. Mot de passe oublié ? Recevez un lien de connexion ci-dessous." }
        : notice.lien === "envoye"
          ? { tone: "ok", text: "Si ce numéro est celui d'un compte JAMAAL, un lien de connexion vient d'arriver sur son WhatsApp (valable 30 minutes). Ouvrez-le depuis ce téléphone." }
          : notice.lien === "numero"
            ? { tone: "err", text: "Numéro incomplet : tapez votre numéro WhatsApp, par exemple 77 123 45 67." }
            : notice.lien === "attente"
              ? { tone: "err", text: "Plusieurs liens ont déjà été demandés : patientez un peu, ou contactez l'équipe JAMAAL." }
              : notice.lien === "indispo"
                ? { tone: "err", text: "L'envoi automatique de liens n'est pas encore activé. Écrivez à l'équipe JAMAAL : elle vous envoie un lien de connexion tout de suite." }
                : notice.reset
                  ? { tone: "ok", text: "Mot de passe enregistré. Connectez-vous avec votre numéro WhatsApp (ou e-mail) et ce mot de passe." }
                  : null;

  return (
    <div>
      {msg && (
        <p role={msg.tone === "err" ? "alert" : "status"} className={`mt-5 rounded-xl border px-4 py-3 text-sm ${msg.tone === "err" ? "border-rose-dark/20 bg-rose/10 text-rose-dark" : "border-emerald-700/20 bg-emerald-50 text-emerald-800"}`}>
          {msg.text}
          {(notice.lien === "indispo" || notice.erreur === "bloque" || notice.lien === "attente") && (
            <a href={help} target="_blank" rel="noopener noreferrer" className="mt-2 block font-semibold underline">Écrire à l&apos;équipe JAMAAL sur WhatsApp</a>
          )}
        </p>
      )}

      <form action={passwordLogin} className="mt-7 flex flex-col gap-5">
        <input type="hidden" name="from" value={from} />
        <input type="hidden" name="next" value={next ?? "/admin"} />
        <div>
          <label htmlFor="login" className="text-xs font-semibold text-navy/85">Numéro WhatsApp ou e-mail</label>
          <input id="login" type="text" name="login" defaultValue={id} placeholder="77 123 45 67" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required className={field} />
        </div>
        <div>
          <label htmlFor="password" className="text-xs font-semibold text-navy/85">Mot de passe</label>
          <input id="password" type="password" name="password" autoComplete="current-password" required className={field} />
        </div>
        <button type="submit" className="rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-light">Se connecter</button>
      </form>

      <div className="my-7 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-navy/40"><span className="h-px flex-1 bg-line" />ou, sans mot de passe<span className="h-px flex-1 bg-line" /></div>

      <form action={whatsappLoginLink} className="flex flex-col gap-3">
        <input type="hidden" name="from" value={from} />
        <label htmlFor="phone" className="text-xs font-semibold text-navy/85">Recevoir un lien de connexion sur mon WhatsApp</label>
        <input id="phone" type="tel" name="phone" inputMode="tel" defaultValue={/\d{6,}/.test(id.replace(/\D/g, "")) && !id.includes("@") ? id : ""} placeholder="77 123 45 67" autoComplete="tel" required className={field} />
        <button type="submit" className="rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1ebe5b]">Recevoir le lien sur WhatsApp</button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2 text-xs">
        <Link href="/admin/forgot-password" className="font-semibold text-rose-dark hover:underline">Mot de passe oublié ?</Link>
        <a href={help} target="_blank" rel="noopener noreferrer" className="text-navy/60 hover:underline">Toujours bloqué ? Écrire à l&apos;équipe JAMAAL</a>
      </div>
    </div>
  );
}
