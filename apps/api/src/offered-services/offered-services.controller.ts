import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OfferedServicesService } from './offered-services.service.js';
import { CreateOfferedServiceDto } from './dto/create-offered-service.dto.js';
import { UpdateOfferedServiceDto } from './dto/update-offered-service.dto.js';

@Controller('clients/:clientId/services')
export class ClientServicesController {
  constructor(private servicesService: OfferedServicesService) {}

  @Post()
  create(@Param('clientId') clientId: string, @Body() dto: CreateOfferedServiceDto) {
    return this.servicesService.create(clientId, dto);
  }

  @Get()
  findAll(@Param('clientId') clientId: string) {
    return this.servicesService.findAllByClient(clientId);
  }
}

@Controller('services')
export class OfferedServicesController {
  constructor(private servicesService: OfferedServicesService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOfferedServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }
}
