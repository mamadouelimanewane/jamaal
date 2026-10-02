/**
 * Export du catalogue public Chogan (lecture seule) vers un fichier CSV.
 *
 * Usage (dans votre navigateur, pas sur le serveur) :
 *   1. Ouvrez https://www.chogangroupspa.com/ et acceptez les cookies.
 *   2. Ouvrez la console (F12 → Console), collez TOUT ce fichier, Entrée.
 *   3. Patientez (~2-4 min, une requête toutes les 350 ms). Un fichier
 *      chogan-catalogue.csv se télécharge à la fin.
 *   4. Placez-le dans import/chogan-catalogue.csv du projet JAMAAL.
 *
 * Il ne collecte que ce que le site affiche publiquement : nom, format, prix
 * public (€), image, lien produit. Les prix sont ceux de Chogan en euros : à
 * convertir / réajuster en FCFA selon votre politique tarifaire.
 */
(async () => {
  const TOP = { Parfums: 455, Beauté: 429, Nutrition: 511, Maison: 493, Accessoires: 473 };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const seen = new Map();

  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const price = (s) => {
    const m = s.match(/(\d[\d.\s]*,\d{2})\s*€/);
    return m ? m[1].replace(/[.\s]/g, "").replace(",", ".") : "";
  };

  for (const [label, id] of Object.entries(TOP)) {
    for (let page = 1; page <= 60; page++) {
      const res = await fetch(`/chogangroup/productList/${id}?page=${page}`, { credentials: "same-origin" });
      if (!res.ok) break;
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const links = [...doc.querySelectorAll("a.product-route")];
      let added = 0;
      for (const a of links) {
        const m = a.href.match(/productDetail\/(\d+)/);
        // Chaque produit a 2 liens (image + titre) : on ne garde que celui qui porte le nom.
        if (!m || !txt(a) || seen.has(m[1])) continue;
        // La carte produit englobe le lien : on remonte jusqu'au conteneur qui a l'image.
        let card = a;
        while (card && !card.querySelector(".card-header") && card.parentElement) card = card.parentElement;
        const bg = card?.querySelector(".card-header")?.getAttribute("style") || "";
        const image = (bg.match(/url\(['"]?([^'")]+)/) || [])[1] || "";
        const badges = [...(card?.querySelectorAll(".label") || [])].map(txt).filter(Boolean).join("|");
        seen.set(m[1], {
          chogan_id: m[1],
          name: txt(a),
          format: txt(card?.querySelector("[class*=product_formato_key]")),
          category_chogan: label,
          price_eur: price(txt(card)),
          image_url: image,
          badges,
          url: `https://www.chogangroupspa.com/chogangroup/productDetail/${m[1]}`,
        });
        added++;
      }
      console.log(`${label} — page ${page} : +${added} (total ${seen.size})`);
      if (added === 0) break;
      await sleep(350);
    }
  }

  const cols = ["chogan_id", "name", "format", "category_chogan", "price_eur", "image_url", "badges", "url"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...[...seen.values()].map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "chogan-catalogue.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log(`Terminé : ${seen.size} produits exportés.`);
})();
