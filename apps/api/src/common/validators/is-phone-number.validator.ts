import { registerDecorator, ValidationOptions } from 'class-validator';
import { isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Válido para cualquier país si el número trae su código internacional
 * (+51..., +34..., etc.). Si no lo trae, se asume Bolivia (mercado
 * principal de la app) en vez de rechazarlo.
 */
export function IsPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPhoneNumber',
      target: object.constructor,
      propertyName,
      options: {
        message: '$property must be a valid phone number',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          return isValidPhoneNumber(value, { defaultCountry: 'BO' });
        },
      },
    });
  };
}
