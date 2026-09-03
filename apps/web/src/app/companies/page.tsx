"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useCompanies, useCreateCompany, useRemoveCompany, useUpdateCompany } from "@/lib/queries";
import { ApiError } from "@/lib/api-client";
import type { Company } from "@/lib/types";

export default function CompaniesPage() {
  const { data: companies, isLoading } = useCompanies();
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const removeCompany = useRemoveCompany();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", cellphone: "" });
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", address: "", cellphone: "" });
  const [editError, setEditError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createCompany.mutateAsync({ name: form.name, address: form.address, cellphone: form.cellphone });
      setForm({ name: "", address: "", cellphone: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la empresa");
    }
  }

  function startEditing(company: Company) {
    setEditingId(company.id);
    setEditForm({ name: company.name, address: company.address ?? "", cellphone: company.cellphone ?? "" });
    setEditError(null);
  }

  async function handleRemove(company: Company) {
    if (!confirm(`¿Eliminar "${company.name}"? Solo se puede borrar si no tiene ningún cliente cargado.`)) {
      return;
    }
    try {
      await removeCompany.mutateAsync(company.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "No se pudo eliminar la empresa");
    }
  }

  async function handleEditSubmit(e: FormEvent, id: string) {
    e.preventDefault();
    setEditError(null);
    try {
      await updateCompany.mutateAsync({
        id,
        name: editForm.name,
        address: editForm.address || undefined,
        cellphone: editForm.cellphone || undefined,
      });
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "No se pudo guardar el cambio");
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Gestor de Cobros</h1>
          <p className="text-sm text-stone-500">Elegí una empresa o creá una nueva.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          {showForm ? "Cancelar" : "Nueva empresa"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-lg border border-stone-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              placeholder="Nombre de la empresa"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input"
            />
            <input
              placeholder="Dirección"
              required
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="input"
            />
            <input
              type="tel"
              placeholder="Celular (ej. +59171234567)"
              required
              value={form.cellphone}
              onChange={(e) => setForm((f) => ({ ...f, cellphone: e.target.value }))}
              className="input"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={createCompany.isPending}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {createCompany.isPending ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        {isLoading ? (
          <p className="p-4 text-sm text-stone-500">Cargando…</p>
        ) : !companies?.length ? (
          <p className="p-4 text-sm text-stone-500">Todavía no hay ninguna empresa cargada.</p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {companies.map((company) =>
              editingId === company.id ? (
                <li key={company.id} className="px-4 py-3">
                  <form onSubmit={(e) => handleEditSubmit(e, company.id)} className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        required
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="input"
                      />
                      <input
                        placeholder="Dirección"
                        required
                        value={editForm.address}
                        onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                        className="input"
                      />
                      <input
                        type="tel"
                        placeholder="Celular (ej. +59171234567)"
                        required
                        value={editForm.cellphone}
                        onChange={(e) => setEditForm((f) => ({ ...f, cellphone: e.target.value }))}
                        className="input"
                      />
                    </div>
                    {editError && <p className="text-sm text-red-600">{editError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={updateCompany.isPending}
                        className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={company.id} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-stone-50">
                  <Link href={`/companies/${company.id}/dashboard`} className="flex-1">
                    <span className="font-medium text-stone-900">{company.name}</span>
                    <span className="ml-2 text-stone-500">{company.address}</span>
                    <span className="ml-2 text-stone-400">{company.cellphone}</span>
                  </Link>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => startEditing(company)}
                      className="text-xs font-medium text-stone-500 hover:text-teal-700"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleRemove(company)}
                      disabled={removeCompany.isPending}
                      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
