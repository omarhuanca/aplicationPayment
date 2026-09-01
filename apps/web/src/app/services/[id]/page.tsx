"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCatalogs,
  useCreatePayment,
  useDeletePayment,
  useRemoveService,
  useService,
  useUpdatePayment,
  useUpdateService,
} from "@/lib/queries";
import { ApiError } from "@/lib/api-client";
import type { PaymentState } from "@/lib/types";

const STATE_STYLES: Record<PaymentState, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  PAGADO: "bg-teal-100 text-teal-800",
  VENCIDO: "bg-red-100 text-red-800",
  CANCELADO: "bg-stone-200 text-stone-600",
};

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: service, isLoading } = useService(id);
  const { data: catalogs } = useCatalogs();
  const companyId = service?.client.companyId ?? "";
  const clientId = service?.client.id ?? "";
  const createPayment = useCreatePayment(id, companyId);
  const updatePayment = useUpdatePayment(id, companyId);
  const deletePayment = useDeletePayment(id, companyId);
  const updateService = useUpdateService(clientId);
  const removeService = useRemoveService(clientId);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ startDate: "", endDate: "", paymentMethod: "" });
  const [error, setError] = useState<string | null>(null);

  const [editingService, setEditingService] = useState(false);
  const [serviceForm, setServiceForm] = useState({ description: "", price: "", coin: "", billingPeriod: "" });
  const [serviceError, setServiceError] = useState<string | null>(null);

  function startEditingService() {
    if (!service) return;
    setServiceForm({
      description: service.description,
      price: service.price,
      coin: service.coin,
      billingPeriod: service.billingPeriod,
    });
    setEditingService(true);
    setServiceError(null);
  }

  async function handleServiceEditSubmit(e: FormEvent) {
    e.preventDefault();
    setServiceError(null);
    try {
      await updateService.mutateAsync({
        id,
        description: serviceForm.description,
        price: Number(serviceForm.price),
        coin: serviceForm.coin,
        billingPeriod: serviceForm.billingPeriod,
      });
      setEditingService(false);
    } catch (err) {
      setServiceError(err instanceof ApiError ? err.message : "No se pudo guardar el cambio");
    }
  }

  async function handleRemoveService() {
    if (!service) return;
    const hasPayments = service.payments.length > 0;
    const message = hasPayments
      ? "Este servicio tiene pagos registrados, así que no se puede borrar: se va a desactivar y dejará de aparecer en la ficha del cliente. ¿Continuar?"
      : "¿Eliminar este servicio? No tiene pagos registrados, así que se borra de forma permanente y no se puede deshacer.";
    if (!confirm(message)) return;
    await removeService.mutateAsync(id);
    router.push(`/companies/${companyId}/clients/${clientId}`);
  }

  const datesAutoCalculated = service?.billingPeriod === "MENSUAL" && (service?.payments.length ?? 0) > 0;
  const lastPayment = service?.payments[0];
  const previewStartDate = datesAutoCalculated && lastPayment ? addMonths(lastPayment.startDate, 1) : null;
  const previewEndDate = datesAutoCalculated && lastPayment ? addMonths(lastPayment.endDate, 1) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createPayment.mutateAsync({
        startDate: datesAutoCalculated ? undefined : form.startDate,
        endDate: datesAutoCalculated ? undefined : form.endDate,
        paymentMethod: form.paymentMethod,
      });
      setForm({ startDate: "", endDate: "", paymentMethod: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el pago");
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm("¿Eliminar este pago? Esta acción borra el registro de forma permanente y no se puede deshacer.")) {
      return;
    }
    await deletePayment.mutateAsync(paymentId);
  }

  if (isLoading || !service) {
    return <p className="p-8 text-sm text-stone-500">Cargando…</p>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div>
        <Link
          href={`/companies/${companyId}/clients/${service.client.id}`}
          className="text-sm text-teal-700 hover:underline"
        >
          ← {service.client.fullname}
        </Link>

        {editingService && catalogs ? (
          <form onSubmit={handleServiceEditSubmit} className="mt-2 space-y-2 rounded-lg border border-stone-200 bg-white p-4">
            <div className="grid gap-2 sm:grid-cols-4">
              <input
                required
                value={serviceForm.description}
                onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))}
                className="input sm:col-span-2"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={serviceForm.price}
                onChange={(e) => setServiceForm((f) => ({ ...f, price: e.target.value }))}
                className="input"
              />
              <select
                required
                value={serviceForm.coin}
                onChange={(e) => setServiceForm((f) => ({ ...f, coin: e.target.value }))}
                className="input"
              >
                {catalogs.coins.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                required
                value={serviceForm.billingPeriod}
                onChange={(e) => setServiceForm((f) => ({ ...f, billingPeriod: e.target.value }))}
                className="input sm:col-span-4"
              >
                {catalogs.billingPeriods.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            {serviceError && <p className="text-sm text-red-600">{serviceError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={updateService.isPending}
                className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditingService(false)}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-1 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-stone-900">{service.description}</h1>
              <p className="text-sm text-stone-500">
                {service.coin} {service.price} · {service.billingPeriod}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={startEditingService} className="text-sm font-medium text-stone-500 hover:text-teal-700">
                Editar
              </button>
              <button onClick={handleRemoveService} className="text-sm font-medium text-red-600 hover:underline">
                {service.payments.length > 0 ? "Desactivar" : "Eliminar"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Historial de pagos
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          {showForm ? "Cancelar" : "Registrar pago"}
        </button>
      </div>

      {showForm && catalogs && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-sm text-stone-500">
            Monto: <span className="font-medium text-stone-900">{service.coin} {service.price}</span> (el precio del servicio)
          </p>
          {datesAutoCalculated && (
            <p className="text-sm text-stone-500">
              Período calculado solo, un mes después del último pago registrado.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="date"
              required
              disabled={datesAutoCalculated}
              value={datesAutoCalculated ? (previewStartDate ?? "") : form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="input disabled:bg-stone-100 disabled:text-stone-500"
              aria-label="Fecha de inicio del período"
            />
            <input
              type="date"
              required
              disabled={datesAutoCalculated}
              value={datesAutoCalculated ? (previewEndDate ?? "") : form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              className="input disabled:bg-stone-100 disabled:text-stone-500"
              aria-label="Fecha de fin del período"
            />
            <select
              required
              value={form.paymentMethod}
              onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
              className="input"
            >
              <option value="" disabled>
                Método
              </option>
              {catalogs.paymentMethods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={createPayment.isPending}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {createPayment.isPending ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        {!service.payments.length ? (
          <p className="p-4 text-sm text-stone-500">Todavía no hay pagos registrados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Período</th>
                <th className="px-4 py-2 font-medium">Monto</th>
                <th className="px-4 py-2 font-medium">Método</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {service.payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-2 text-stone-700">
                    {formatDate(payment.startDate)} → {formatDate(payment.endDate)}
                  </td>
                  <td className="px-4 py-2 font-medium text-stone-900">
                    {service.coin} {payment.amount}
                  </td>
                  <td className="px-4 py-2 text-stone-500">
                    <select
                      value={payment.paymentMethod}
                      onChange={(e) => updatePayment.mutate({ id: payment.id, paymentMethod: e.target.value })}
                      className="rounded border-0 bg-transparent text-stone-500"
                    >
                      {catalogs?.paymentMethods.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={payment.paymentState}
                      onChange={(e) =>
                        updatePayment.mutate({ id: payment.id, paymentState: e.target.value })
                      }
                      className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${STATE_STYLES[payment.paymentState]}`}
                    >
                      {catalogs?.paymentStates.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/payments/${payment.id}`} className="text-xs font-medium text-teal-700 hover:underline">
                        Ver
                      </Link>
                      <button
                        onClick={() => handleDeletePayment(payment.id)}
                        disabled={deletePayment.isPending}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: "UTC" });
}

/** Igual al cálculo del backend: un mes después, con clamp al último día del mes destino. */
function addMonths(iso: string, months: number): string {
  const date = new Date(iso);
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const daysInTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(date.getUTCDate(), daysInTargetMonth));
  return result.toISOString().slice(0, 10);
}
