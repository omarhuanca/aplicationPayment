import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api-client";
import type {
  Catalogs,
  Client,
  ClientWithServices,
  Company,
  DashboardSummary,
  OfferedServiceWithPayments,
  Payment,
  PaymentReportRow,
  PaymentWithContext,
} from "./types";

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: () => apiFetch<Company[]>("/companies"),
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: ["companies", id],
    queryFn: () => apiFetch<Company>(`/companies/${id}`),
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; address: string; cellphone: string }) =>
      apiFetch<Company>("/companies", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; address?: string; cellphone?: string }) =>
      apiFetch<Company>(`/companies/${id}`, { method: "PATCH", body: data }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["companies", id] });
    },
  });
}

export function useRemoveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useDashboardSummary(companyId: string) {
  return useQuery({
    queryKey: ["dashboard-summary", companyId],
    queryFn: () => apiFetch<DashboardSummary>(`/companies/${companyId}/dashboard/summary`),
    enabled: !!companyId,
  });
}

export function useCatalogs() {
  return useQuery({
    queryKey: ["catalogs"],
    queryFn: () => apiFetch<Catalogs>("/catalogs"),
    staleTime: Infinity,
  });
}

export function useClients(companyId: string) {
  return useQuery({
    queryKey: ["clients", companyId],
    queryFn: () => apiFetch<Client[]>(`/companies/${companyId}/clients`),
    enabled: !!companyId,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ["client", id],
    queryFn: () => apiFetch<ClientWithServices>(`/clients/${id}`),
    enabled: !!id,
  });
}

export function useCreateClient(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fullname: string }) =>
      apiFetch<Client>(`/companies/${companyId}/clients`, { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients", companyId] }),
  });
}

export function useUpdateClient(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; fullname?: string }) =>
      apiFetch<Client>(`/clients/${id}`, { method: "PATCH", body: data }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["clients", companyId] });
      qc.invalidateQueries({ queryKey: ["client", id] });
    },
  });
}

export function useRemoveClient(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ deleted: boolean }>(`/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients", companyId] }),
  });
}

export function useCreateService(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { description: string; price: number; coin: string; billingPeriod: string }) =>
      apiFetch(`/clients/${clientId}/services`, { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client", clientId] }),
  });
}

export function useUpdateService(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      description?: string;
      price?: number;
      coin?: string;
      billingPeriod?: string;
    }) => apiFetch(`/services/${id}`, { method: "PATCH", body: data }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["services", id] });
    },
  });
}

export function useRemoveService(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ deleted: boolean }>(`/services/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client", clientId] }),
  });
}

export function useService(id: string) {
  return useQuery({
    queryKey: ["services", id],
    queryFn: () => apiFetch<OfferedServiceWithPayments>(`/services/${id}`),
    enabled: !!id,
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: ["payments", id],
    queryFn: () => apiFetch<PaymentWithContext>(`/payments/${id}`),
    enabled: !!id,
  });
}

export function useCreatePayment(serviceId: string, companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { startDate?: string; endDate?: string; paymentMethod: string }) =>
      apiFetch(`/services/${serviceId}/payments`, { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services", serviceId] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary", companyId] });
    },
  });
}

export function useUpdatePayment(serviceId: string, companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; paymentState?: string; paymentMethod?: string }) =>
      apiFetch<Payment>(`/payments/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services", serviceId] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary", companyId] });
    },
  });
}

export interface PaymentsReportFilters {
  state: string;
  from: string;
  to: string;
}

export function usePaymentsReport(companyId: string, filters: PaymentsReportFilters) {
  const params = new URLSearchParams();
  if (filters.state) params.set("state", filters.state);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();

  return useQuery({
    queryKey: ["payments-report", companyId, filters],
    queryFn: () => apiFetch<PaymentReportRow[]>(`/companies/${companyId}/reports/payments${qs ? `?${qs}` : ""}`),
    enabled: !!companyId,
  });
}

export function useDeletePayment(serviceId: string, companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/payments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services", serviceId] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary", companyId] });
    },
  });
}
