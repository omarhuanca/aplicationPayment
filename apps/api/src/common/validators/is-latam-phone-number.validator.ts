import { registerDecorator, ValidationOptions } from 'class-validator';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

const LATAM_COUNTRY_CODES: CountryCode[] = [
  'AR', // Argentina
  'BO', // Bolivia
  'BR', // Brasil
  'CL', // Chile
  'CO', // Colombia
  'CR', // Costa Rica
  'CU', // Cuba
  'DO', // República Dominicana
  'EC', // Ecuador
  'SV', // El Salvador
  'GT', // Guatemala
  'HN', // Honduras
  'MX', // México
  'NI', // Nicaragua
  'PA', // Panamá
  'PY', // Paraguay
  'PE', // Perú
  'UY', // Uruguay
  'VE', // Venezuela
];

export function IsLatamPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isLatamPhoneNumber',
      target: object.constructor,
      propertyName,
      options: {
        message: 'cellphone must be a valid Latin American phone number (e.g. +5491122334455)',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const phoneNumber = parsePhoneNumberFromString(value);
          if (!phoneNumber || !phoneNumber.isValid()) return false;
          return LATAM_COUNTRY_CODES.includes(phoneNumber.country as CountryCode);
        },
      },
    });
  };
}
