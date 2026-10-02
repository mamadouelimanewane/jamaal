-- 1) Migration candidatures + catégories (à coller dans Neon > SQL Editor)
BEGIN;
CREATE TYPE "ApplicationStatus" AS ENUM ('NOUVELLE', 'ACCEPTEE', 'REFUSEE');

CREATE TABLE "ConsultantApplication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Sénégal',
    "experience" TEXT,
    "motivation" TEXT,
    "sponsorCode" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NOUVELLE',
    "adminNote" TEXT,
    "consultantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "ConsultantApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConsultantApplication_status_createdAt_idx" ON "ConsultantApplication"("status", "createdAt");
CREATE INDEX "ConsultantApplication_email_idx" ON "ConsultantApplication"("email");

INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","logs","rolled_back_at","started_at","applied_steps_count") VALUES ('51016658-9343-46df-a335-c60b8bf512e8','059c3674890d4eb9fdab5d6a88c06b1a269a7215ae9cdded96b231578b3c8464',now(),'20261002010000_consultant_applications',NULL,NULL,now(),1);
-- Catégories (ne crée que celles qui manquent)
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-parfum-femme','parfum-femme','Parfum JAMAAL Femme','JAMAAL Femme','Une collection de parfums pour femme, inspirés des plus grandes maisons de parfumerie, conçus pour révéler votre élégance au quotidien.','rose',0 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='parfum-femme');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-parfum-homme','parfum-homme','Parfum JAMAAL Homme','JAMAAL Homme','Des fragrances masculines intenses et raffinées, pensées pour affirmer votre caractère en toute occasion.','navy',1 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='parfum-homme');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-parfum-unisexe','parfum-unisexe','Parfum JAMAAL Unisexe','JAMAAL Unisexe','Des fragrances unisexes, entre bois précieux, ambre et notes minérales, à porter sans distinction.','navy',2 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='parfum-unisexe');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-aurodhea','aurodhea','Soins Aurodhea','Aurodhea','Une gamme de soins visage et cheveux haut de gamme, pour sublimer votre peau au quotidien.','rose',3 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='aurodhea');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-lolum','lolum','Huiles Lolum','Lolum','Des mélanges d''huiles végétales et essentielles, formulés pour nourrir, repulper et purifier la peau.','rose',4 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='lolum');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-maquillage','maquillage','Maquillage JAMAAL','Maquillage','Une sélection de maquillage longue tenue, pour sublimer votre regard et votre teint.','rose',5 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='maquillage');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-bijoux','bijoux','Bijoux à offrir','Bijoux','Des bijoux délicats à associer à votre parfum préféré, pour un cadeau inoubliable.','navy',6 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='bijoux');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-entretien-maison','entretien-maison','Entretien Maison','Entretien Maison','Des produits d''entretien concentrés et écoresponsables pour une maison impeccable.','navy',7 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='entretien-maison');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-parfum-ambiance','parfum-ambiance','Parfums d''ambiance','Parfum d''ambiance','Diffusez chez vous les senteurs signature JAMAAL grâce à notre gamme de parfums d''intérieur.','rose',8 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='parfum-ambiance');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-complement-alimentaire','complement-alimentaire','Compléments alimentaires','Compléments','Des compléments alimentaires pensés pour accompagner votre bien-être au quotidien.','navy',9 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='complement-alimentaire');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-autres-produits','autres-produits','Autres produits JAMAAL','Autres produits','Le reste de notre univers JAMAAL, à découvrir sans attendre.','navy',10 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='autres-produits');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-gels-douche','gels-douche','Gels douche parfumés','Gels douche','Des gels douche parfumés, inspirés des grands parfums, pour une toilette sensorielle.','rose',11 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='gels-douche');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-cremes-corps','cremes-corps','Crèmes corps parfumées','Crèmes corps','Des crèmes corporelles parfumées qui hydratent et laissent un sillage délicat.','rose',12 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='cremes-corps');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-etuis-parfum','etuis-parfum','Étuis parfum de poche','Étuis de poche','Des étuis élégants pour emporter votre parfum partout avec vous.','navy',13 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='etuis-parfum');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-soins-corps','soins-corps','Soins corps & hygiène','Soins corps','Savons, crèmes, déodorants et soins d''hygiène au quotidien.','rose',14 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='soins-corps');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-soins-visage','soins-visage','Soins du visage','Soins visage','Nettoyants, sérums, crèmes et masques pour toutes les peaux.','rose',15 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='soins-visage');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-soins-cheveux','soins-cheveux','Soins cheveux','Soins cheveux','Shampoings, masques, sérums et brumes pour des cheveux en pleine santé.','navy',16 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='soins-cheveux');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-soleil','soleil','Produits solaires','Solaire','Sprays, huiles et soins après-soleil pour profiter de l''été en toute sérénité.','rose',17 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='soleil');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-remedes-onguents','remedes-onguents','Remèdes & onguents','Remèdes','Gels apaisants, pommades et baumes pour les petits maux du quotidien.','navy',18 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='remedes-onguents');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-animaux','animaux','Produits pour animaux','Animaux','Une gamme de soins dédiée à vos compagnons à quatre pattes.','navy',19 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='animaux');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-nutrition-sport','nutrition-sport','Nutrition sportive','Nutrition sport','Compléments pour accompagner vos entraînements et votre récupération.','navy',20 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='nutrition-sport');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-substituts-repas','substituts-repas','Substituts de repas','Substituts de repas','Des shakes pour un repas équilibré, rapide et gourmand.','navy',21 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='substituts-repas');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-cafe-boissons','cafe-boissons','Café & boissons','Café','Cafés en grains, capsules, dosettes et boissons chaudes.','navy',22 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='cafe-boissons');
INSERT INTO "Category" ("id","slug","label","navLabel","description","accent","position") SELECT 'cat-accessoires','accessoires','Accessoires','Accessoires','Accessoires, goodies et articles à associer à votre routine.','navy',23 WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE "slug"='accessoires');
COMMIT;
