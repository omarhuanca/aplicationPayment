-- Convierte Coin, PaymentMethod y BillingPeriod de enums globales a catálogos
-- editables por empresa. PaymentState queda intacto (enum fijo, usado por la
-- lógica de negocio del dashboard y los recordatorios).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tablas nuevas (con nombre temporal para no chocar con los enums existentes)
CREATE TABLE "CoinNew" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoinNew_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentMethodNew" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentMethodNew_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingPeriodNew" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingPeriodNew_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoinNew_companyId_code_key" ON "CoinNew"("companyId", "code");
CREATE INDEX "CoinNew_companyId_idx" ON "CoinNew"("companyId");
CREATE UNIQUE INDEX "PaymentMethodNew_companyId_code_key" ON "PaymentMethodNew"("companyId", "code");
CREATE INDEX "PaymentMethodNew_companyId_idx" ON "PaymentMethodNew"("companyId");
CREATE UNIQUE INDEX "BillingPeriodNew_companyId_code_key" ON "BillingPeriodNew"("companyId", "code");
CREATE INDEX "BillingPeriodNew_companyId_idx" ON "BillingPeriodNew"("companyId");

ALTER TABLE "CoinNew" ADD CONSTRAINT "CoinNew_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentMethodNew" ADD CONSTRAINT "PaymentMethodNew_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingPeriodNew" ADD CONSTRAINT "BillingPeriodNew_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Sembrar los valores por defecto (los mismos que antes eran fijos) para cada empresa existente
INSERT INTO "CoinNew" ("id", "companyId", "code", "label", "updatedAt")
SELECT gen_random_uuid()::text, c."id", v.code, v.label, CURRENT_TIMESTAMP
FROM "Company" c
CROSS JOIN (VALUES
    ('ARS', 'Peso argentino'),
    ('USD', 'Dólar estadounidense'),
    ('EUR', 'Euro')
) AS v(code, label);

INSERT INTO "PaymentMethodNew" ("id", "companyId", "code", "label", "updatedAt")
SELECT gen_random_uuid()::text, c."id", v.code, v.label, CURRENT_TIMESTAMP
FROM "Company" c
CROSS JOIN (VALUES
    ('EFECTIVO', 'Efectivo'),
    ('TRANSFERENCIA', 'Transferencia'),
    ('TARJETA', 'Tarjeta'),
    ('OTRO', 'Otro')
) AS v(code, label);

INSERT INTO "BillingPeriodNew" ("id", "companyId", "code", "label", "updatedAt")
SELECT gen_random_uuid()::text, c."id", v.code, v.label, CURRENT_TIMESTAMP
FROM "Company" c
CROSS JOIN (VALUES
    ('MENSUAL', 'Mensual'),
    ('TRIMESTRAL', 'Trimestral'),
    ('SEMESTRAL', 'Semestral'),
    ('ANUAL', 'Anual'),
    ('UNICO', 'Pago único')
) AS v(code, label);

-- 3. Agregar las columnas nuevas y completarlas a partir del valor de enum existente
ALTER TABLE "OfferedService" ADD COLUMN "coinId" TEXT;
ALTER TABLE "OfferedService" ADD COLUMN "billingPeriodId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "paymentMethodId" TEXT;

UPDATE "OfferedService" os
SET "coinId" = cn."id"
FROM "CoinNew" cn, "Client" cl
WHERE cl."id" = os."clientId" AND cn."companyId" = cl."companyId" AND cn."code" = os."coin"::text;

UPDATE "OfferedService" os
SET "billingPeriodId" = bp."id"
FROM "BillingPeriodNew" bp, "Client" cl
WHERE cl."id" = os."clientId" AND bp."companyId" = cl."companyId" AND bp."code" = os."billingPeriod"::text;

UPDATE "Payment" p
SET "paymentMethodId" = pm."id"
FROM "PaymentMethodNew" pm, "OfferedService" os, "Client" cl
WHERE os."id" = p."offeredServiceId" AND cl."id" = os."clientId" AND pm."companyId" = cl."companyId" AND pm."code" = p."paymentMethod"::text;

-- 4. Quitar las columnas de enum viejas y dejar las nuevas como obligatorias
ALTER TABLE "OfferedService" DROP COLUMN "coin";
ALTER TABLE "OfferedService" DROP COLUMN "billingPeriod";
ALTER TABLE "Payment" DROP COLUMN "paymentMethod";

ALTER TABLE "OfferedService" ALTER COLUMN "coinId" SET NOT NULL;
ALTER TABLE "OfferedService" ALTER COLUMN "billingPeriodId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "paymentMethodId" SET NOT NULL;

-- 5. Ahora que ninguna columna usa los enums viejos, se pueden borrar
DROP TYPE "Coin";
DROP TYPE "PaymentMethod";
DROP TYPE "BillingPeriod";

-- 6. Renombrar las tablas nuevas a su nombre final
ALTER TABLE "CoinNew" RENAME TO "Coin";
ALTER TABLE "PaymentMethodNew" RENAME TO "PaymentMethod";
ALTER TABLE "BillingPeriodNew" RENAME TO "BillingPeriod";

-- 7. Foreign keys de OfferedService/Payment hacia los catálogos
ALTER TABLE "OfferedService" ADD CONSTRAINT "OfferedService_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfferedService" ADD CONSTRAINT "OfferedService_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "BillingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "OfferedService_coinId_idx" ON "OfferedService"("coinId");
CREATE INDEX "OfferedService_billingPeriodId_idx" ON "OfferedService"("billingPeriodId");
CREATE INDEX "Payment_paymentMethodId_idx" ON "Payment"("paymentMethodId");
