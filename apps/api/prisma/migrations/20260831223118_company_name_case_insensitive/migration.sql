-- Company.name pasa a ser case-insensitive (citext): "Acme SRL", "acme srl" y
-- "ACME SRL" se consideran el mismo nombre para la restricción de unicidad.
CREATE EXTENSION IF NOT EXISTS citext;

ALTER TABLE "Company" ALTER COLUMN "name" TYPE CITEXT;
