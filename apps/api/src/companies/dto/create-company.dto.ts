import { IsString, MinLength } from 'class-validator';
import { IsPhoneNumber } from '../../common/validators/is-phone-number.validator.js';

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
