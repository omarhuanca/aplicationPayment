import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOfferedServiceDto } from './dto/create-offered-service.dto.js';
import { UpdateOfferedServiceDto } from './dto/update-offered-service.dto.js';

@Injectable()
export class OfferedServicesService {
  constructor(private prisma: PrismaService) {}

  async create(clientId: string, dto: CreateOfferedServiceDto) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    try {
      return await this.prisma.offeredService.create({ data: { ...dto, clientId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Este cliente ya tiene un servicio con esa descripción');
      }
      throw err;
    }
  }

  findAllByClient(clientId: string) {
    return this.prisma.offeredService.findMany({
      where: { clientId, active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.offeredService.findUnique({
      where: { id },
      include: { client: true, payments: { orderBy: { startDate: 'desc' } } },
    });
    if (!service) throw new NotFoundException('Servicio no encontrado');
    return service;
  }

  async update(id: string, dto: UpdateOfferedServiceDto) {
    await this.findOne(id);
    try {
      return await this.prisma.offeredService.update({ where: { id }, data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Este cliente ya tiene un servicio con esa descripción');
      }
      throw err;
    }
  }

  /**
   * Sin pagos asociados: borrado físico. Con pagos asociados no se puede borrar
   * (Payment.offeredService es onDelete: Restrict, para no perder el historial),
   * así que se desactiva en su lugar.
   */
  async remove(id: string) {
    await this.findOne(id);

    const paymentCount = await this.prisma.payment.count({ where: { offeredServiceId: id } });
    if (paymentCount === 0) {
      await this.prisma.offeredService.delete({ where: { id } });
      return { deleted: true as const };
    }

    await this.prisma.offeredService.update({ where: { id }, data: { active: false } });
    return { deleted: false as const };
  }
}
