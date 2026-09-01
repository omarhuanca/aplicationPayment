"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useClients, useCreateClient } from "@/lib/queries";
import { ApiError } from "@/lib/api-client";

export default function ClientsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { data: clients, isLoading } = useClients(companyId);
  const createClient = useCreateClient(companyId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullname: "" });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createClient.mutateAsync({ fullname: form.fullname });
      setForm({ fullname: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el cliente");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">Clientes</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          {showForm ? "Cancelar" : "Nuevo cliente"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
          <input
            placeholder="Nombre completo"
            required
            value={form.fullname}
            onChange={(e) => setForm({ fullname: e.target.value })}
            className="input"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={createClient.isPending}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {createClient.isPending ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        {isLoading ? (
          <p className="p-4 text-sm text-stone-500">Cargando…</p>
        ) : !clients?.length ? (
          <p className="p-4 text-sm text-stone-500">Todavía no cargaste ningún cliente.</p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {clients.map((client) => (
              <li key={client.id}>
                <Link
                  href={`/companies/${companyId}/clients/${client.id}`}
                  className="flex items-center px-4 py-3 text-sm hover:bg-stone-50"
                >
                  <span className="font-medium text-stone-900">{client.fullname}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
