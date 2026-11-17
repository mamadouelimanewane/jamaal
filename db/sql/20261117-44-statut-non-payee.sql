-- Nouveau statut de commande « Non payée » (rien encaissé). Ajouté seul : une valeur d'énumération
-- ne peut pas servir dans la transaction qui la crée.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'NON_PAYEE' BEFORE 'EN_ATTENTE';
