# Import du catalogue officiel

Ce dossier permet de brancher votre vrai catalogue CHOGAN (récupéré depuis
votre espace consultant) sans toucher au code.

## Étapes

1. **Récupérez dans votre espace consultant CHOGAN :**
   - la liste des produits (nom, numéro, prix par volume) — export CSV/Excel/PDF
     si disponible, sinon un simple relevé manuel ;
   - les photos officielles que CHOGAN autorise ses consultants à utiliser.

2. **Copiez le modèle :**
   ```bash
   cp import/products.template.csv import/products.csv
   ```

3. **Remplissez `import/products.csv`** (une ligne par produit) :

   | Colonne | Obligatoire | Description |
   |---|---|---|
   | `number` | non | numéro du parfum (laisser vide pour les produits hors parfum) |
   | `name` | **oui** | nom du produit |
   | `category` | **oui** | une des valeurs : `parfum-femme`, `parfum-homme`, `aurodhea`, `lolum`, `maquillage`, `bijoux`, `entretien-maison`, `parfum-ambiance`, `complement-alimentaire`, `autres-produits` |
   | `slug` | non | identifiant URL (généré automatiquement si vide) |
   | `family` | non | famille olfactive |
   | `top_notes` / `heart_notes` / `base_notes` | non | notes séparées par `;` |
   | `tester_price` / `price_30ml` / `price_70ml` | non | prix par volume (parfums) |
   | `regular_price` | non | prix unique (produits hors parfum) |
   | `review_count` / `rating` | non | avis (nombre / note sur 5) |
   | `description` | non | paragraphes séparés par `\|\|` |
   | `photo` | non | nom du fichier photo, placé dans `import/photos/` |

4. **Déposez vos photos** dans `import/photos/` (le nom doit correspondre à la
   colonne `photo` du CSV, ex. `n121.jpg`).

5. **Lancez l'import :**
   ```bash
   npm run import:catalog
   ```
   Cela régénère `src/data/official-catalog.json` et copie les photos
   utilisées dans `public/produits/`. Les catégories non couvertes par votre
   CSV gardent le catalogue de démonstration.

6. **Vérifiez en local** (`npm run dev`), puis déployez normalement
   (`git add -A && git commit && git push` — Vercel redéploiera automatiquement).

## Remarques

- Ce dossier (`import/`) et son contenu réel ne sont pas fournis avec le projet :
  vous devez y déposer vos propres fichiers récupérés légitimement depuis votre
  espace consultant CHOGAN.
- N'utilisez jamais de photos ou textes copiés depuis le site d'un autre
  consultant ou revendeur : ce contenu leur appartient, pas à CHOGAN en libre
  usage.
