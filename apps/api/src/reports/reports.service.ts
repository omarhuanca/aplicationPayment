import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentsReportQueryDto } from './dto/payments-report-query.dto.js';

export interface PaymentRow {
  id: string;
  clientId: string;
  serviceId: string;
  clientName: string;
  serviceDescription: string;
  startDate: Date;
  endDate: Date;
  amount: string;
  coin: string;
  paymentState: string;
  paymentMethod: string;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getPaymentRows(companyId: string, query: PaymentsReportQueryDto): Promise<PaymentRow[]> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    const payments = await this.prisma.payment.findMany({
      where: {
        offeredService: { client: { companyId } },
        ...(query.state ? { paymentState: query.state } : {}),
        ...(query.from || query.to
          ? {
              startDate: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: { offeredService: { include: { client: true } } },
      orderBy: { startDate: 'desc' },
    });

    return payments.map((p) => ({
      id: p.id,
      clientId: p.offeredService.client.id,
      serviceId: p.offeredService.id,
      clientName: p.offeredService.client.fullname,
      serviceDescription: p.offeredService.description,
      startDate: p.startDate,
      endDate: p.endDate,
      amount: p.amount.toString(),
      coin: p.offeredService.coin,
      paymentState: p.paymentState,
      paymentMethod: p.paymentMethod,
    }));
  }

  toCsv(rows: PaymentRow[]): string {
    const header = ['Cliente', 'Servicio', 'Inicio', 'Fin', 'Monto', 'Moneda', 'Estado', 'Método'];
    const lines = [header.map(csvEscape).join(',')];
    for (const row of rows) {
      lines.push(
        [
          row.clientName,
          row.serviceDescription,
          formatDate(row.startDate),
          formatDate(row.endDate),
          row.amount,
          row.coin,
          row.paymentState,
          row.paymentMethod,
        ]
          .map(csvEscape)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  toPdf(rows: PaymentRow[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text('Reporte de pagos', { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#666').text(`Generado el ${formatDate(new Date())} · ${rows.length} pagos`);
      doc.moveDown(1);

      const columns = [
        { label: 'Cliente', width: 110 },
        { label: 'Servicio', width: 110 },
        { label: 'Período', width: 100 },
        { label: 'Monto', width: 70 },
        { label: 'Estado', width: 70 },
        { label: 'Método', width: 60 },
      ];

      const startX = doc.page.margins.left;
      let y = doc.y;

      function drawRow(values: string[], isHeader = false) {
        let x = startX;
        doc.fontSize(8).fillColor(isHeader ? '#000' : '#222');
        values.forEach((value, i) => {
          doc.text(value, x, y, { width: columns[i].width, ellipsis: true });
          x += columns[i].width;
        });
        y += 16;
      }

      drawRow(columns.map((c) => c.label), true);
      doc
        .moveTo(startX, y - 4)
        .lineTo(startX + columns.reduce((sum, c) => sum + c.width, 0), y - 4)
        .strokeColor('#ccc')
        .stroke();

      for (const row of rows) {
        if (y > doc.page.height - doc.page.margins.bottom - 20) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        drawRow([
          row.clientName,
          row.serviceDescription,
          `${formatDate(row.startDate)} - ${formatDate(row.endDate)}`,
          `${row.coin} ${row.amount}`,
          row.paymentState,
          row.paymentMethod,
        ]);
      }

      doc.end();
    });
  }
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
