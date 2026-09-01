-- Los métodos de pago quedan restringidos a EFECTIVO y QR únicamente
-- (se sacan TRANSFERENCIA, TARJETA y OTRO). Postgres no permite borrar
-- valores de un enum directamente, así que se recrea el tipo.
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";

CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'QR');

ALTER TABLE "Payment" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING ("paymentMethod"::text::"PaymentMethod");

DROP TYPE "PaymentMethod_old";
