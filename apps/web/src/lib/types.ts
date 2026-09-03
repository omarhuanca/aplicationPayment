export type Coin = "ARS" | "USD" | "EUR" | "BOB";
export type PaymentState = "PENDIENTE" | "PAGADO" | "VENCIDO" | "CANCELADO";
export type PaymentMethod = "EFECTIVO" | "QR";
export type BillingPeriod = "MENSUAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL" | "UNICO";

export interface Company {
  id: string;
  name: string;
  address: string;
  cellphone: string;
  createdAt: string;
}

export interface Client {
  id: string;
  companyId: string;
  fullname: string;
  active: boolean;
  createdAt: string;
}

export interface ClientWithServices extends Client {
  offeredServices: OfferedService[];
}

export interface OfferedService {
  id: string;
  clientId: string;
  description: string;
  price: string;
  coin: Coin;
  billingPeriod: BillingPeriod;
  active: boolean;
  createdAt: string;
}

export interface OfferedServiceWithPayments extends OfferedService {
  client: Client;
  payments: Payment[];
}

export interface Payment {
  id: string;
  offeredServiceId: string;
  amount: string;
  startDate: string;
  endDate: string;
  paymentState: PaymentState;
  paymentMethod: PaymentMethod;
  createdAt: string;
}

export interface PaymentWithContext extends Payment {
  offeredService: OfferedService & {
    client: Client & { company: Company };
  };
}

export interface Catalogs {
  coins: Coin[];
  paymentStates: PaymentState[];
  paymentMethods: PaymentMethod[];
  billingPeriods: BillingPeriod[];
}

export interface PaymentReportRow {
  id: string;
  clientId: string;
  serviceId: string;
  clientName: string;
  serviceDescription: string;
  startDate: string;
  endDate: string;
  amount: string;
  coin: Coin;
  paymentState: PaymentState;
  paymentMethod: PaymentMethod;
}

export interface DashboardSummary {
  pendingCount: number;
  overdueCount: number;
  activeClients: number;
  activeServices: number;
  incomeThisMonth: string | number;
}
