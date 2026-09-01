import { Controller, Get } from '@nestjs/common';
import { BillingPeriod, Coin, PaymentMethod, PaymentState } from '@prisma/client';

@Controller('catalogs')
export class CatalogsController {
  @Get()
  findAll() {
    return {
      coins: Object.values(Coin),
      paymentStates: Object.values(PaymentState),
      paymentMethods: Object.values(PaymentMethod),
      billingPeriods: Object.values(BillingPeriod),
    };
  }
}
