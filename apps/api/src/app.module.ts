import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { CompaniesModule } from './companies/companies.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { OfferedServicesModule } from './offered-services/offered-services.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { CatalogsModule } from './catalogs/catalogs.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { ReportsModule } from './reports/reports.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CompaniesModule,
    ClientsModule,
    OfferedServicesModule,
    PaymentsModule,
    CatalogsModule,
    DashboardModule,
    ReportsModule,
  ],
})
export class AppModule {}
