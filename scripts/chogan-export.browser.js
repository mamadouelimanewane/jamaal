/**
 * Export du catalogue complet Chogan vers Excel (CSV)
 *
 * Usage :
 * 1. Allez sur https://www.chogangroupspa.com/ et connectez-vous
 * 2. Ouvrez la console (F12 > Console)
 * 3. Collez ce script entier et tapez Entrée.
 */
(async () => {
  console.log("Démarrage de l'extraction de TOUS les produits Chogan...");
  
  // Récupération dynamique de TOUTES les catégories
  const catLinks = [...document.querySelectorAll('a[href*="/productList/"]')];
  const TOP = {};
  for (const a of catLinks) {
    const m = a.href.match(/\/productList\/(\d+)/);
    if (m && a.textContent.trim()) {
      TOP[a.textContent.trim()] = m[1];
    }
  }
  
  if (Object.keys(TOP).length === 0) {
    Object.assign(TOP, { Parfums: 455, Beauté: 429, Nutrition: 511, Maison: 493, Accessoires: 473 });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const seen = new Map();

  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const parsePrice = (s) => {
    const m = s.match(/(\d[\d.\s]*,\d{2})/);
    return m ? parseFloat(m[1].replace(/[.\s]/g, "").replace(",", ".")) : 0;
  };

  for (const [label, id] of Object.entries(TOP)) {
    console.log(`Exploration de la catégorie: ${label} ...`);
    for (let page = 1; page <= 60; page++) {
      const res = await fetch(`/chogangroup/productList/${id}?page=${page}`, { credentials: "same-origin" });
      if (!res.ok) break;
      
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const links = [...doc.querySelectorAll("a.product-route")];
      let added = 0;
      
      for (const a of links) {
        const m = a.href.match(/productDetail\/(\d+)/);
        if (!m || !txt(a) || seen.has(m[1])) continue;
        
        let card = a;
        while (card && !card.querySelector(".card-header") && card.parentElement) card = card.parentElement;
        
        const productName = txt(a);
        const format = txt(card?.querySelector("[class*=product_formato_key]"));
        let price_eur = parsePrice(txt(card));
        
        // Calcul du prix public JAMAAL (+25% après conversion en FCFA)
        const price_fcfa = Math.round(price_eur * 655.957 * 1.25);
        
        seen.set(m[1], {
          chogan_id: m[1],
          name: productName + (format ? ` (${format})` : ""),
          category: label,
          price_eur: price_eur,
          price_fcfa: price_fcfa
        });
        added++;
      }
      
      console.log(`   - ${label} Page ${page} : ${added} produits trouvés.`);
      if (added === 0) break;
      await sleep(350); // Pause pour ne pas bloquer le navigateur
    }
  }

  console.log(`Génération du fichier Excel pour ${seen.size} produits...`);

  const cols = ["Réf.", "Produit", "Catégorie", "Prix Chogan (€)", "Nouveau prix JAMAAL"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  
  // Création du CSV avec un séparateur point-virgule (plus compatible avec Excel en français)
  const csvRows = [cols.join(";")];
  for (const r of seen.values()) {
    csvRows.push([
      esc(r.chogan_id),
      esc(r.name),
      esc(r.category),
      esc(r.price_eur),
      esc(r.price_fcfa)
    ].join(";"));
  }
  
  // Utilisation de UTF-8 avec BOM pour une ouverture correcte dans Excel
  const csv = "\ufeff" + csvRows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Catalogue_Chogan_Complet.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  
  console.log(`Terminé ! Le fichier Catalogue_Chogan_Complet.csv a été téléchargé.`);
  alert(`Félicitations ! L'extraction est terminée.\n${seen.size} produits ont été téléchargés dans un fichier Excel.`);
})();
