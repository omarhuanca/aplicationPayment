CREATE UNIQUE INDEX "Payment_offeredServiceId_startDate_endDate_key" ON "Payment"("offeredServiceId", "startDate", "endDate");
