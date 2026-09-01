import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('companies/:companyId/dashboard')
export class DashboardController {
  constructor(private prisma: PrismaService) {}

  @Get('summary')
  async summary(@Param('companyId') companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    const companyScope = { offeredService: { client: { companyId } } };

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const [pendingCount, overdueCount, activeClients, activeServices, incomeThisMonth] = await Promise.all([
      this.prisma.payment.count({ where: { ...companyScope, paymentState: 'PENDIENTE' } }),
      this.prisma.payment.count({ where: { ...companyScope, paymentState: 'VENCIDO' } }),
      this.prisma.client.count({ where: { companyId, active: true } }),
      this.prisma.offeredService.count({ where: { active: true, client: { companyId } } }),
      this.prisma.payment.aggregate({
        where: { ...companyScope, paymentState: 'PAGADO', startDate: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
    ]);

    return {
      pendingCount,
      overdueCount,
      activeClients,
      activeServices,
      incomeThisMonth: incomeThisMonth._sum.amount ?? 0,
    };
  }
}
