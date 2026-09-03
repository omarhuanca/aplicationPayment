import { IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  address!: string;

  @IsPhoneNumber()
  cellphone!: string;
}
