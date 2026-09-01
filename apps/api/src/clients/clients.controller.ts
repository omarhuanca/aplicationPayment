import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ClientsService } from './clients.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';

@Controller('companies/:companyId/clients')
export class CompanyClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  create(@Param('companyId') companyId: string, @Body() dto: CreateClientDto) {
    return this.clientsService.create(companyId, dto);
  }

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.clientsService.findAllByCompany(companyId);
  }
}

@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
