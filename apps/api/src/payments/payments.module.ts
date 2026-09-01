import { Module } from '@nestjs/common';
import { PaymentsController, ServicePaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  controllers: [PaymentsController, ServicePaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
