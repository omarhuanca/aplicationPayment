import { IsEnum, IsOptional } from 'class-validator';
import { PaymentMethod, PaymentState } from '@prisma/client';

export class UpdatePaymentDto {
  @IsOptional()
  @IsEnum(PaymentState)
  paymentState?: PaymentState;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
