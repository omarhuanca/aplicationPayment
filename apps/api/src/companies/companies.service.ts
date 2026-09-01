import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCompanyDto) {
    try {
      return await this.prisma.company.create({ data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya existe una empresa con ese nombre');
      }
      throw err;
    }
  }

  findAll() {
    return this.prisma.company.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);
    try {
      return await this.prisma.company.update({ where: { id }, data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya existe una empresa con ese nombre');
      }
      throw err;
    }
  }

  /**
   * Company no tiene borrado lógico (no está en el diagrama), así que solo se
   * puede borrar físicamente, y solo si no le queda ningún Client (ni siquiera
   * desactivado) — de lo contrario se perdería toda esa cadena de datos.
   */
  async remove(id: string) {
    await this.findOne(id);

    const clientCount = await this.prisma.client.count({ where: { companyId: id } });
    if (clientCount > 0) {
      throw new ConflictException(
        `No se puede eliminar la empresa: todavía tiene ${clientCount} cliente(s) asociado(s).`,
      );
    }

    await this.prisma.company.delete({ where: { id } });
  }
}
