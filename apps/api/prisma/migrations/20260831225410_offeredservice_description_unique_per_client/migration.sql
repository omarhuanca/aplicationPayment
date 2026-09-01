-- OfferedService.description pasa a ser case-insensitive (citext) y único
-- dentro de cada cliente (el mismo cliente no puede tener dos servicios con
-- la misma descripción, sin importar mayúsculas/minúsculas).
ALTER TABLE "OfferedService" ALTER COLUMN "description" TYPE CITEXT;

CREATE UNIQUE INDEX "OfferedService_clientId_description_key" ON "OfferedService"("clientId", "description");
