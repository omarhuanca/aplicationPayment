import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  /** Opcional: si el servicio es MENSUAL y ya tiene un pago previo, se calcula solo. */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
