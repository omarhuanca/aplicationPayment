import { Module } from '@nestjs/common';
import { ClientServicesController, OfferedServicesController } from './offered-services.controller.js';
import { OfferedServicesService } from './offered-services.service.js';

@Module({
  controllers: [ClientServicesController, OfferedServicesController],
  providers: [OfferedServicesService],
})
export class OfferedServicesModule {}
