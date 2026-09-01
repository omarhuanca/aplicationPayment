"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCatalogs,
  useClient,
  useCreateService,
  useRemoveClient,
  useUpdateClient,
} from "@/lib/queries";
import { ApiError } from "@/lib/api-client";

export default function ClientDetailPage() {
  const { companyId, clientId } = useParams<{ companyId: string; clientId: string }>();
  const router = useRouter();
  const { data: client, isLoading } = useClient(clientId);
  const { data: catalogs } = useCatalogs();
  const createService = useCreateService(clientId);
  const updateClient = useUpdateClient(companyId);
  const removeClient = useRemoveClient(companyId);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: "", price: "", coin: "", billingPeriod: "" });
  const [error, setError] = useState<string | null>(null);

  const [editingClient, setEditingClient] = useState(false);
  const [clientForm, setClientForm] = useState({ fullname: "" });
  const [clientError, setClientError] = useState<string | null>(null);

  function startEditingClient() {
    if (!client) return;
    setClientForm({ fullname: client.fullname });
    setEditingClient(true);
    setClientError(null);
  }

  async function handleClientEditSubmit(e: FormEvent) {
    e.preventDefault();
    setClientError(null);
    try {
      await updateClient.mutateAsync({ id: clientId, fullname: clientForm.fullname });
      setEditingClient(false);
    } catch (err) {
      setClientError(err instanceof ApiError ? err.message : "No se pudo guardar el cambio");
    }
  }

  async function handleRemoveClient() {
    const message =
      "¿Eliminar este cliente? Si no tiene ningún servicio (ni siquiera desactivado) se borra de forma " +
      "permanente; si tiene alguno, se desactiva para no perder ese historial.";
    if (!confirm(message)) return;
    const result = await removeClient.mutateAsync(clientId);
    alert(result.deleted ? "Cliente eliminado de forma permanente." : "El cliente tenía servicios asociados: se desactivó en vez de borrarse.");
    router.push(`/companies/${companyId}/clients`);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createService.mutateAsync({
        description: form.description,
        price: Number(form.price),
        coin: form.coin,
        billingPeriod: form.billingPeriod,
      });
      setForm({ description: "", price: "", coin: "", billingPeriod: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el servicio");
    }
  }

  if (isLoading || !client) {
    return <p className="text-sm text-stone-500">Cargando…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/companies/${companyId}/clients`} className="text-sm text-teal-700 hover:underline">
          ← Clientes
        </Link>

        {editingClient ? (
          <form onSubmit={handleClientEditSubmit} className="mt-2 space-y-2 rounded-lg border border-stone-200 bg-white p-4">
            <input
              required
              value={clientForm.fullname}
              onChange={(e) => setClientForm({ fullname: e.target.value })}
              className="input"
            />
            {clientError && <p className="text-sm text-red-600">{clientError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={updateClient.isPending}
                className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditingClient(false)}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-1 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-stone-900">{client.fullname}</h1>
            </div>
            <div className="flex gap-3">
              <button onClick={startEditingClient} className="text-sm font-medium text-stone-500 hover:text-teal-700">
                Editar
              </button>
              <button onClick={handleRemoveClient} className="text-sm font-medium text-red-600 hover:underline">
                Eliminar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Servicios ofrecidos
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          {showForm ? "Cancelar" : "Nuevo servicio"}
        </button>
      </div>

      {showForm && catalogs && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <input
              placeholder="Descripción"
              required
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="input sm:col-span-2"
            />
            <input
              placeholder="Precio"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="input"
            />
            <select
              required
              value={form.coin}
              onChange={(e) => setForm((f) => ({ ...f, coin: e.target.value }))}
              className="input"
            >
              <option value="" disabled>
                Moneda
              </option>
              {catalogs.coins.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              required
              value={form.billingPeriod}
              onChange={(e) => setForm((f) => ({ ...f, billingPeriod: e.target.value }))}
              className="input sm:col-span-4"
            >
              <option value="" disabled>
                Periodicidad de facturación
              </option>
              {catalogs.billingPeriods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={createService.isPending}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {createService.isPending ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        {!client.offeredServices.length ? (
          <p className="p-4 text-sm text-stone-500">Este cliente todavía no tiene servicios.</p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {client.offeredServices.map((service) => (
              <li key={service.id}>
                <Link
                  href={`/services/${service.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-stone-50"
                >
                  <span className="font-medium text-stone-900">{service.description}</span>
                  <span className="text-stone-500">
                    {service.coin} {service.price} · {service.billingPeriod}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
