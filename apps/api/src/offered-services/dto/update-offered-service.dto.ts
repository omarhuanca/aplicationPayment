import { PartialType } from '@nestjs/mapped-types';
import { CreateOfferedServiceDto } from './create-offered-service.dto.js';

export class UpdateOfferedServiceDto extends PartialType(CreateOfferedServiceDto) {}
