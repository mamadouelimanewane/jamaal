import { accountingContext, type SP } from "@/lib/accounting/page-context";
import { CLASS_LABELS, DEFAULT_ACCOUNTS } from "@/lib/accounting/chart";
import { REGIMES } from "@/lib/accounting/config";
import { addAccountAction, removeAccountAction, saveAccountingSettingsAction } from "@/lib/actions/accounting";
import { btn, Card, field } from "@/components/accounting/ui";

export const dynamic = "force-dynamic";

export default async function ReglagesPage({ searchParams }: { searchParams: SP }) {
  const { L } = await accountingContext(searchParams);
  const s = L.settings;
  const defaults = new Set(DEFAULT_ACCOUNTS.map((a) => a.code));
  const customCodes = new Set(s.customAccounts.map((a) => a.code));
  const classes = [...new Set(L.accounts.map((a) => a.code[0]))].sort();
  return (
    <div className="space-y-6">
      <h2 className="font-serif-display text-xl font-semibold text-navy">Réglages comptables</h2>
      <Card title="Entreprise et règles">
        <form action={saveAccountingSettingsAction} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-navy">Raison sociale<input name="name" defaultValue={s.company.name} className={`mt-1 ${field}`} /></label>
          <label className="text-sm text-navy">Régime fiscal
            <select name="regime" defaultValue={s.company.regime} className={`mt-1 ${field}`}>{REGIMES.map((r) => <option key={r}>{r}</option>)}</select>
          </label>
          <label className="text-sm text-navy">NINEA<input name="ninea" defaultValue={s.company.ninea} className={`mt-1 ${field}`} /></label>
          <label className="text-sm text-navy">RCCM<input name="rccm" defaultValue={s.company.rccm} className={`mt-1 ${field}`} /></label>
          <label className="text-sm text-navy sm:col-span-2">Adresse<input name="address" defaultValue={s.company.address} className={`mt-1 ${field}`} /></label>
          <label className="text-sm text-navy">Début de la comptabilité<input type="date" name="startDate" defaultValue={s.startDate} className={`mt-1 ${field}`} />
            <span className="mt-1 block text-xs text-navy/65">Vide : 1er jour du mois de la première opération ({L.start.toLocaleDateString("fr-FR", { timeZone: "UTC" })}). Le stock à cette date devient le stock d&apos;ouverture.</span>
          </label>
          <label className="text-sm text-navy">Achats de marchandises
            <select name="purchaseMode" defaultValue={s.purchaseMode} className={`mt-1 ${field}`}>
              <option value="DEPENSES">Saisis en dépenses (compte 601)</option>
              <option value="RECEPTIONS">Constatés à la réception du stock</option>
            </select>
            <span className="mt-1 block text-xs text-navy/65">« Réception » : chaque entrée en stock crée une dette envers Chogan (401) ; la dépense saisie ensuite la règle.</span>
          </label>
          <fieldset className="rounded-xl border border-line p-3 sm:col-span-2">
            <legend className="px-1 text-sm font-semibold text-navy">TVA</legend>
            <label className="flex items-center gap-2 text-sm text-navy"><input type="checkbox" name="vatEnabled" defaultChecked={s.vatEnabled} /> JAMAAL est assujetti à la TVA (prix de vente TTC)</label>
            <label className="mt-2 block text-sm text-navy">Taux (%)<input name="vatRate" inputMode="decimal" defaultValue={s.vatRate} className={`mt-1 max-w-32 ${field}`} /></label>
          </fieldset>
          <fieldset className="grid gap-3 rounded-xl border border-line p-3 sm:col-span-2 sm:grid-cols-3">
            <legend className="px-1 text-sm font-semibold text-navy">Frais des moyens de paiement (% de chaque encaissement)</legend>
            <label className="text-sm text-navy">Wave<input name="feeWave" inputMode="decimal" defaultValue={s.fees.WAVE} className={`mt-1 ${field}`} /></label>
            <label className="text-sm text-navy">Orange Money<input name="feeOm" inputMode="decimal" defaultValue={s.fees.ORANGE_MONEY} className={`mt-1 ${field}`} /></label>
            <label className="text-sm text-navy">Carte (Stripe)<input name="feeStripe" inputMode="decimal" defaultValue={s.fees.STRIPE} className={`mt-1 ${field}`} /></label>
            <p className="text-xs text-navy/65 sm:col-span-3">Vérifiez vos contrats (Wave Business : 1 % en général). Ces frais passent en charge (631) et le compte reçoit le net.</p>
          </fieldset>
          <div className="sm:col-span-2"><button className={btn}>Enregistrer</button></div>
        </form>
      </Card>

      <Card title="Ajouter un compte">
        <form action={addAccountAction} className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
          <input name="code" required inputMode="numeric" placeholder="ex. 5211" className={`${field} font-mono`} />
          <input name="label" required placeholder="ex. Banque CBAO" className={field} />
          <button className={btn}>Ajouter</button>
        </form>
        <p className="mt-2 text-xs text-navy/65">Pour suivre une deuxième banque (5211, 5212…), un poste de charge précis (62211 Loyer boutique) ou renommer un compte existant.</p>
      </Card>

      <Card title="Plan comptable (SYSCOHADA)">
        <div className="grid gap-5 md:grid-cols-2">
          {classes.map((c) => (
            <div key={c}>
              <p className="mb-1 text-sm font-semibold text-navy">Classe {c} · {CLASS_LABELS[c]}</p>
              <ul className="text-sm">
                {L.accounts.filter((a) => a.code[0] === c).map((a) => (
                  <li key={a.code} className="flex items-center justify-between gap-2 border-b border-line/60 py-1">
                    <span><span className="font-mono text-xs text-navy/80">{a.code}</span> {a.label}</span>
                    {customCodes.has(a.code) && (
                      <form action={removeAccountAction.bind(null, a.code)}><button className="text-xs font-semibold text-red-700 hover:underline">{defaults.has(a.code) ? "Libellé d'origine" : "Retirer"}</button></form>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Comment la comptabilité est tenue">
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-navy/85">
          <li><strong>Ventes</strong> : constatées quand la commande est payée (Wave, Orange Money, carte, wallet), ou livrée si le client paie à la livraison. Une commande annulée n&apos;est pas une vente.</li>
          <li><strong>Encaissements</strong> : sur le compte du moyen de paiement ; le paiement à la livraison va en caisse (571). Les acomptes de réservation restent des avances clients jusqu&apos;à la vente.</li>
          <li><strong>Réseau</strong> : commissions et primes en charge (6322), parts des livreurs en transport (612) ; tant qu&apos;elles sont sur les wallets, c&apos;est une dette (4671 / 4672) qui baisse à chaque retrait.</li>
          <li><strong>Stock</strong> : valorisé au prix d&apos;achat Chogan ; chaque fin de mois, la variation de stock corrige les achats pour donner le vrai coût des ventes.</li>
          <li><strong>Saisies à la main</strong> : dépenses, et écritures diverses (apports, virements entre comptes, emprunts, soldes d&apos;ouverture, amortissements).</li>
        </ul>
      </Card>
    </div>
  );
}
