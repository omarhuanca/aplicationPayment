import { IsString, MinLength } from 'class-validator';
import { IsLatamPhoneNumber } from '../../common/validators/is-latam-phone-number.validator.js';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  address!: string;

  @IsLatamPhoneNumber()
  cellphone!: string;
}
