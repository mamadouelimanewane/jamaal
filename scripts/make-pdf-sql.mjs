import fs from 'fs';
const existing = JSON.parse(fs.readFileSync('src/data/chogan-catalog.json', 'utf8'));
const products = JSON.parse(fs.readFileSync('import/pdf_products.json', 'utf8'));

const getCategory = (code, name) => {
  if (code.startsWith('BSF')) return 'gels-douche';
  if (code.startsWith('CRF')) return 'cremes-corps';
  if (code.startsWith('COP')) return 'parfum-ambiance';
  if (code.startsWith('LO')) return 'lolum';
  if (code.startsWith('MM')) return 'maquillage';
  if (code.startsWith('BH')) return 'entretien-maison';
  if (code.startsWith('AR') || code.startsWith('BV') || code.startsWith('NM')) return 'soins-corps';
  if (code.startsWith('CAP') || code.startsWith('SHM')) return 'soins-cheveux';
  if (name.toLowerCase().includes('homme')) return 'parfum-homme';
  if (name.toLowerCase().includes('femme')) return 'parfum-femme';
  if (name.toLowerCase().includes('dentifrice')) return 'soins-corps';
  return 'autres-produits';
};

const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').trim();
const slugify = (s) => norm(s).slice(0, 60).replace(/-$/, '');

let sql = '-- DUMP GENERATED FOR NEW PDF PRODUCTS\n\n';
let count = 0;
for (const p of products) {
  const normName = p.name.toLowerCase().trim();
  const ext = existing.find(e => 
    e.id === 'chogan-'+p.code || 
    (e.choganCode && e.choganCode === p.code) ||
    e.name.toLowerCase().trim() === normName
  );
  if (ext) continue;
  
  const slug = slugify(p.name) + '-' + p.code.toLowerCase();
  const id = 'chogan-' + p.code;
  const publicPrice = Math.round(p.price_fcfa / 1.25);
  
  sql += `INSERT INTO "Product" (
    "id", "slug", "name", "category", "shortDescription", "longDescription", 
    "regularPrice", "publicPrice", "stock", "lowStockThreshold", 
    "isOfficial", "choganCode", "rating", "reviewCount", "colorFrom", "colorTo"
  ) VALUES (
    '${id}', '${slug}', '${p.name.replace(/'/g, "''")}', '${getCategory(p.code, p.name)}',
    '${p.name.replace(/'/g, "''")} (${p.format}). Produit Chogan.',
    '["${p.name.replace(/'/g, "''")}. Format : ${p.format}"]',
    ${p.price_fcfa}, ${publicPrice}, 0, 5,
    true, '${p.code}', 4.5, 0, '#1d2f4f', '#d9a99d'
  ) ON CONFLICT ("slug") DO NOTHING;\n`;
  count++;
}
fs.writeFileSync('import/neon/B-ajouter-pdf-produits.sql', sql);
console.log('Created SQL file for ' + count + ' products!');
