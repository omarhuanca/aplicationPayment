import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { UpdatePaymentDto } from './dto/update-payment.dto.js';

@Controller('services/:serviceId/payments')
export class ServicePaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post()
  create(@Param('serviceId') serviceId: string, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(serviceId, dto);
  }

  @Get()
  findAll(@Param('serviceId') serviceId: string) {
    return this.paymentsService.findAllByService(serviceId);
  }
}

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Get(':id/export.pdf')
  async exportPdf(@Param('id') id: string, @Res() res: Response) {
    const pdf = await this.paymentsService.buildReceiptPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="pago-${id}.pdf"`);
    res.send(pdf);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.paymentsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }
}
