import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service.js';
import { PaymentsReportQueryDto } from './dto/payments-report-query.dto.js';

@Controller('companies/:companyId/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('payments')
  paymentsJson(@Param('companyId') companyId: string, @Query() query: PaymentsReportQueryDto) {
    return this.reportsService.getPaymentRows(companyId, query);
  }

  @Get('payments.csv')
  async paymentsCsv(
    @Param('companyId') companyId: string,
    @Query() query: PaymentsReportQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.reportsService.getPaymentRows(companyId, query);
    const csv = this.reportsService.toCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pagos.csv"');
    res.send(csv);
  }

  @Get('payments.pdf')
  async paymentsPdf(
    @Param('companyId') companyId: string,
    @Query() query: PaymentsReportQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.reportsService.getPaymentRows(companyId, query);
    const pdf = await this.reportsService.toPdf(rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="pagos.pdf"');
    res.send(pdf);
  }
}
