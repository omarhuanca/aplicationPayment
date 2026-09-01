import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, dto: CreateClientDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    try {
      return await this.prisma.client.create({ data: { ...dto, companyId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya existe un cliente con ese nombre en esta empresa');
      }
      throw err;
    }
  }

  findAllByCompany(companyId: string) {
    return this.prisma.client.findMany({
      where: { companyId, active: true },
      orderBy: { fullname: 'asc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { offeredServices: { where: { active: true } } },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    try {
      return await this.prisma.client.update({ where: { id }, data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya existe un cliente con ese nombre en esta empresa');
      }
      throw err;
    }
  }

  /**
   * Sin ningún OfferedService asociado (ni siquiera desactivado): borrado físico.
   * Con al menos uno, no se puede borrar (se perdería su historial de pagos),
   * así que se desactiva en su lugar.
   */
  async remove(id: string) {
    await this.findOne(id);

    const serviceCount = await this.prisma.offeredService.count({ where: { clientId: id } });
    if (serviceCount === 0) {
      await this.prisma.client.delete({ where: { id } });
      return { deleted: true as const };
    }

    await this.prisma.client.update({ where: { id }, data: { active: false } });
    return { deleted: false as const };
  }
}
