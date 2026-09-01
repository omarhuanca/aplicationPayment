import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaymentState } from '@prisma/client';

export class PaymentsReportQueryDto {
  @IsOptional()
  @IsEnum(PaymentState)
  state?: PaymentState;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
