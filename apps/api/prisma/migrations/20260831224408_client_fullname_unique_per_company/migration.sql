-- Client.fullname pasa a ser case-insensitive (citext) y único dentro de cada
-- empresa (dos empresas distintas sí pueden tener un cliente con el mismo
-- nombre; la misma empresa no puede repetirlo).
ALTER TABLE "Client" ALTER COLUMN "fullname" TYPE CITEXT;

CREATE UNIQUE INDEX "Client_companyId_fullname_key" ON "Client"("companyId", "fullname");
