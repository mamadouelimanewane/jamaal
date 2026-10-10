const fs = require('fs');
const slugify = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60).replace(/-$/, '');

let sql = '-- DUMP GENERATED FOR CSVs\n\n';

function appendSql(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(';');
    if (parts.length < 5) continue;
    
    const code = parts[0];
    const name = parts[1].replace(/'/g, "''");
    const category = parts[2];
    const p_fcfa = parseInt(parts[4]);
    const publicPrice = Math.round(p_fcfa / 1.25);
    
    const id = 'chogan-' + code;
    const slug = slugify(parts[1]) + '-' + code.toLowerCase();
    
    sql += `INSERT INTO "Product" ("id", "slug", "name", "category", "shortDescription", "longDescription", "regularPrice", "publicPrice", "stock", "lowStockThreshold", "isOfficial", "choganCode", "rating", "reviewCount", "colorFrom", "colorTo") VALUES ('${id}', '${slug}', '${name}', '${category}', '${name}. Produit Chogan.', '["${name}. Produit officiel Chogan."]', ${p_fcfa}, ${publicPrice}, 0, 5, true, '${code}', 4.5, 0, '#1d2f4f', '#d9a99d') ON CONFLICT ("slug") DO UPDATE SET "regularPrice" = EXCLUDED."regularPrice", "publicPrice" = EXCLUDED."publicPrice";\n`;
    count++;
  }
  console.log('Added ' + count + ' products from ' + filePath);
}

appendSql('C:/Users/DIA/Downloads/Extractions_Catalogues.csv');
appendSql('C:/Users/DIA/Downloads/Extractions_Lolum.csv');

fs.writeFileSync('import/neon/C-ajouter-produits-images.sql', sql);
