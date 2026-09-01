import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsPositive, IsString, MinLength } from 'class-validator';
import { BillingPeriod, Coin } from '@prisma/client';

export class CreateOfferedServiceDto {
  @IsString()
  @MinLength(2)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price!: number;

  @IsEnum(Coin)
  coin!: Coin;

  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;
}
