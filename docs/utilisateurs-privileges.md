# Utilisateurs, rôles et privilèges

Admin → **Utilisateurs** (réservé à l'administrateur complet).

## Rôles
Administrateur, Consultant (revendeur), Livreur, Client. Consultant et Livreur exigent une fiche rattachée.

## Privilèges de l'équipe
Un administrateur est :
- **complet** (aucun profil) : accès à tout, y compris comptes, profils, diagnostics et export complet ;
- **restreint** (un profil) : accès uniquement aux modules du profil, en **lecture** ou en **écriture**.

12 modules : Catalogue, Commandes et réservations, Clients, Revendeurs et réseau, Livraison, Stocks,
Comptabilité et finances, Statistiques, Marketing et contenu, WhatsApp et automatisations, Réglages et modèle
économique, Utilisateurs et journal. Le module *Utilisateurs* n'est jamais délégable.

Profils proposés en un clic : Comptable, Gestionnaire de stock, Support client, Responsable marketing,
Logisticien, Responsable revendeurs, Consultation seule. On peut aussi créer un profil sur mesure.

## Ce qui est contrôlé
- **Pages** : chaque dossier d'administration est gardé par un module (layout) ; le menu n'affiche que les modules permis.
- **Actions** : chaque action serveur annonce son module et son niveau (`requireAdmin("catalogue")`).
  Sans module, l'opération est réservée à l'administrateur complet (refus par défaut).
- **API et exports** : même règle (`requireAdminForApi("clients")`). L'export complet et les diagnostics sont réservés à l'administrateur complet.
- **Assistant IA et WhatsApp** : l'assistant d'administration et les pouvoirs d'administrateur par WhatsApp ne sont pas donnés à un administrateur restreint.
- Le rôle, le statut et le profil sont **relus en base** à chaque contrôle.

## Gestion des comptes
Fiche utilisateur : identité et identifiant de connexion, rôle et profil, rattachement de fiche, mot de passe ou
lien d'accès à usage unique (7 jours), suspension / réactivation, suppression, activité récente.

Garde-fous : on ne peut pas se supprimer, se suspendre ni modifier son propre rôle ; le **dernier administrateur
complet** ne peut être ni supprimé, ni suspendu, ni rétrogradé, ni restreint ; un profil encore attribué ne peut pas
être supprimé (ses utilisateurs deviendraient administrateurs complets) ; un compte suspendu ne peut plus se
connecter et sa session est coupée au plus tard sous 5 minutes. Toutes les opérations sont inscrites au journal des actions.

## Base de données
`db/sql/20261018-18-utilisateurs-privileges.sql` (appliqué automatiquement au déploiement) : colonnes `User.active`,
`User.lastLoginAt`, `User.profileId` et table `AccessProfile`. Les comptes existants restent actifs et complets.
