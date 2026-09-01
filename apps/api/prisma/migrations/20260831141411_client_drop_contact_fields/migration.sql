-- Client vuelve a tener solo fullname (más su lista de OfferedService), como
-- en el diagrama de clases. email/phone eran un agregado propio, no del diagrama.
ALTER TABLE "Client" DROP COLUMN "email";
ALTER TABLE "Client" DROP COLUMN "phone";
