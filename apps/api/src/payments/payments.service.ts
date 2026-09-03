import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { UpdatePaymentDto } from './dto/update-payment.dto.js';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(offeredServiceId: string, dto: CreatePaymentDto) {
    const service = await this.prisma.offeredService.findUnique({ where: { id: offeredServiceId } });
    if (!service) throw new NotFoundException('Servicio no encontrado');

    const { startDate, endDate } = await this.resolvePeriod(offeredServiceId, service.billingPeriod, dto);

    if (endDate < startDate) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio');
    }

    const duplicate = await this.prisma.payment.findUnique({
      where: { offeredServiceId_startDate_endDate: { offeredServiceId, startDate, endDate } },
    });
    if (duplicate) {
      throw new ConflictException('Ya existe un pago registrado para este servicio con ese mismo período');
    }

    try {
      return await this.prisma.payment.create({
        data: {
          offeredServiceId,
          amount: service.price,
          startDate,
          endDate,
          paymentMethod: dto.paymentMethod,
          paymentState: 'PAGADO',
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya existe un pago registrado para este servicio con ese mismo período');
      }
      throw err;
    }
  }

  /**
   * Para servicios MENSUAL, a partir del segundo pago las fechas se calculan
   * solas: un mes después del período del pago anterior. El primer pago (o
   * cualquier otra periodicidad) sigue necesitando que se indiquen a mano.
   */
  private async resolvePeriod(
    offeredServiceId: string,
    billingPeriod: string,
    dto: CreatePaymentDto,
  ): Promise<{ startDate: Date; endDate: Date }> {
    if (billingPeriod === 'MENSUAL') {
      const lastPayment = await this.prisma.payment.findFirst({
        where: { offeredServiceId },
        orderBy: { endDate: 'desc' },
      });

      if (lastPayment) {
        return {
          startDate: addMonths(lastPayment.startDate, 1),
          endDate: addMonths(lastPayment.endDate, 1),
        };
      }
    }

    if (!dto.startDate || !dto.endDate) {
      throw new BadRequestException('Hay que indicar la fecha de inicio y la fecha de fin');
    }
    return { startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) };
  }

  findAllByService(offeredServiceId: string) {
    return this.prisma.payment.findMany({
      where: { offeredServiceId },
      orderBy: { startDate: 'desc' },
    });
  }

  /** Vista completa: el pago junto con su servicio, cliente y empresa. */
  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        offeredService: {
          include: {
            client: {
              include: { company: true },
            },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    return payment;
  }

  /**
   * Recibo angosto pensado para impresoras térmicas de rollo 80mm (Epson
   * TM-T20 y compatibles): ancho fijo de 80mm, fuente monoespaciada y alto
   * ajustado al contenido en vez de una página A4 completa.
   */
  async buildReceiptPdf(id: string): Promise<Buffer> {
    const payment = await this.findOne(id);
    const { offeredService: service } = payment;
    const { client } = service;
    const { company } = client;

    const PAGE_WIDTH = 227; // 80mm de ancho de rollo, en puntos (1mm ≈ 2.83pt)
    const MARGIN = 10;
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

    type Line =
      | { text: string; size: number; bold?: boolean; align?: 'left' | 'center' }
      | { divider: true };

    const lines: Line[] = [
      { text: company.name, size: 11, bold: true, align: 'center' },
      { text: company.address, size: 8, align: 'center' },
      { text: company.cellphone, size: 8, align: 'center' },
      { divider: true },
      { text: 'DETALLE DE PAGO', size: 9, bold: true, align: 'center' },
      { divider: true },
      { text: `Cliente: ${client.fullname}`, size: 8 },
      { text: `Servicio: ${service.description}`, size: 8 },
      { text: `Precio: ${service.coin} ${service.price}`, size: 8 },
      { text: `Periodicidad: ${service.billingPeriod}`, size: 8 },
      { divider: true },
      { text: `Periodo: ${formatDate(payment.startDate)} - ${formatDate(payment.endDate)}`, size: 8 },
      { text: `Monto: ${service.coin} ${payment.amount}`, size: 10, bold: true },
      { text: `Metodo: ${payment.paymentMethod}`, size: 8 },
      { divider: true },
    ];

    // Alto estimado a partir del contenido, con un colchón por si algún
    // texto largo hace wrap a una segunda línea.
    const estimatedHeight =
      MARGIN * 2 +
      lines.reduce((sum, line) => sum + ('divider' in line ? 10 : Math.ceil(line.size * 1.7)), 0) +
      30;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: [PAGE_WIDTH, estimatedHeight], margin: MARGIN });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      for (const line of lines) {
        if ('divider' in line) {
          doc.moveDown(0.2);
          doc
            .moveTo(MARGIN, doc.y)
            .lineTo(PAGE_WIDTH - MARGIN, doc.y)
            .lineWidth(0.5)
            .strokeColor('#000000')
            .stroke();
          doc.moveDown(0.3);
          continue;
        }
        doc
          .font(line.bold ? 'Courier-Bold' : 'Courier')
          .fontSize(line.size)
          .fillColor('#000000')
          .text(line.text, MARGIN, doc.y, { width: CONTENT_WIDTH, align: line.align ?? 'left' });
      }

      doc.end();
    });
  }

  async update(id: string, dto: UpdatePaymentDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    return this.prisma.payment.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    await this.prisma.payment.delete({ where: { id } });
  }
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const daysInTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(date.getUTCDate(), daysInTargetMonth));
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
