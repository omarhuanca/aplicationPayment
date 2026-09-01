import { Module } from '@nestjs/common';
import { ClientsController, CompanyClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';

@Module({
  controllers: [CompanyClientsController, ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
