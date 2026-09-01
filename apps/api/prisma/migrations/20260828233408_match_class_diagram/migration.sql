-- Vuelve el modelo a lo que muestra el diagrama de clases: sin User (no hay
-- login), y Coin/PaymentMethod/BillingPeriod como valores fijos otra vez
-- (no editables por empresa).

-- 1. Traer de vuelta las columnas de enum en base al código del catálogo referenciado
ALTER TABLE "OfferedService" ADD COLUMN "coin" TEXT;
ALTER TABLE "OfferedService" ADD COLUMN "billingPeriod" TEXT;
ALTER TABLE "Payment" ADD COLUMN "paymentMethod" TEXT;

UPDATE "OfferedService" os SET "coin" = c."code" FROM "Coin" c WHERE c."id" = os."coinId";
UPDATE "OfferedService" os SET "billingPeriod" = bp."code" FROM "BillingPeriod" bp WHERE bp."id" = os."billingPeriodId";
UPDATE "Payment" p SET "paymentMethod" = pm."code" FROM "PaymentMethod" pm WHERE pm."id" = p."paymentMethodId";

-- 2. Quitar las columnas y tablas de catálogo por empresa
ALTER TABLE "OfferedService" DROP CONSTRAINT "OfferedService_coinId_fkey";
ALTER TABLE "OfferedService" DROP CONSTRAINT "OfferedService_billingPeriodId_fkey";
ALTER TABLE "OfferedService" DROP COLUMN "coinId";
ALTER TABLE "OfferedService" DROP COLUMN "billingPeriodId";

ALTER TABLE "Payment" DROP CONSTRAINT "Payment_paymentMethodId_fkey";
ALTER TABLE "Payment" DROP COLUMN "paymentMethodId";

DROP TABLE "Coin";
DROP TABLE "PaymentMethod";
DROP TABLE "BillingPeriod";

-- 3. Recrear los enums fijos (ahora que no hay tablas con el mismo nombre)
CREATE TYPE "Coin" AS ENUM ('ARS', 'USD', 'EUR');
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO');
CREATE TYPE "BillingPeriod" AS ENUM ('MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'UNICO');

ALTER TABLE "OfferedService" ALTER COLUMN "coin" TYPE "Coin" USING "coin"::"Coin";
ALTER TABLE "OfferedService" ALTER COLUMN "billingPeriod" TYPE "BillingPeriod" USING "billingPeriod"::"BillingPeriod";
ALTER TABLE "Payment" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING "paymentMethod"::"PaymentMethod";

ALTER TABLE "OfferedService" ALTER COLUMN "coin" SET NOT NULL;
ALTER TABLE "OfferedService" ALTER COLUMN "billingPeriod" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "paymentMethod" SET NOT NULL;

-- 4. Sacar la entidad User (no está en el diagrama; no hay login)
ALTER TABLE "User" DROP CONSTRAINT "User_companyId_fkey";
DROP TABLE "User";
DROP TYPE "Role";
