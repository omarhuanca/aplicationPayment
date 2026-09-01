"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCatalogs, usePaymentsReport, type PaymentsReportFilters } from "@/lib/queries";
import { apiDownload, ApiError } from "@/lib/api-client";

const EMPTY_FILTERS: PaymentsReportFilters = { state: "", from: "", to: "" };

export default function ReportsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { data: catalogs } = useCatalogs();
  const [filters, setFilters] = useState<PaymentsReportFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<PaymentsReportFilters>(EMPTY_FILTERS);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<"csv" | "pdf" | null>(null);

  const { data: rows, isLoading, isFetching } = usePaymentsReport(companyId, appliedFilters);

  function buildQuery() {
    const params = new URLSearchParams();
    if (appliedFilters.state) params.set("state", appliedFilters.state);
    if (appliedFilters.from) params.set("from", appliedFilters.from);
    if (appliedFilters.to) params.set("to", appliedFilters.to);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedFilters(filters);
  }

  async function handleDownload(format: "csv" | "pdf") {
    setDownloadError(null);
    setIsDownloading(format);
    try {
      await apiDownload(`/companies/${companyId}/reports/payments.${format}${buildQuery()}`, `pagos.${format}`);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "No se pudo descargar el reporte");
    } finally {
      setIsDownloading(null);
    }
  }

  const total = rows?.reduce((sum, row) => sum + Number(row.amount), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Reportes</h1>
        <p className="text-sm text-stone-500">Exportá el detalle de pagos filtrado por estado y período.</p>
      </div>

      <form onSubmit={handleSearch} className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={filters.state}
            onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))}
            className="input"
          >
            <option value="">Todos los estados</option>
            {catalogs?.paymentStates.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="input"
            aria-label="Desde"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="input"
            aria-label="Hasta"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isFetching}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {isFetching ? "Buscando..." : "Buscar"}
          </button>

          <div className="ml-auto flex gap-3">
            <button
              type="button"
              onClick={() => handleDownload("csv")}
              disabled={isDownloading !== null || !rows?.length}
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {isDownloading === "csv" ? "Generando..." : "Descargar CSV"}
            </button>
            <button
              type="button"
              onClick={() => handleDownload("pdf")}
              disabled={isDownloading !== null || !rows?.length}
              className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
            >
              {isDownloading === "pdf" ? "Generando..." : "Descargar PDF"}
            </button>
          </div>
        </div>

        {downloadError && <p className="text-sm text-red-600">{downloadError}</p>}
      </form>

      <div className="rounded-lg border border-stone-200 bg-white">
        {isLoading ? (
          <p className="p-4 text-sm text-stone-500">Cargando…</p>
        ) : !rows?.length ? (
          <p className="p-4 text-sm text-stone-500">No hay pagos que coincidan con los filtros.</p>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <p className="text-sm text-stone-500">{rows.length} pagos encontrados</p>
              <p className="text-sm font-medium text-stone-900">
                Total: {rows[0]?.coin ?? ""} {total.toFixed(2)}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-4 py-2 font-medium">Servicio</th>
                    <th className="px-4 py-2 font-medium">Período</th>
                    <th className="px-4 py-2 font-medium">Monto</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 font-medium">Método</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-2">
                        <Link href={`/companies/${companyId}/clients/${row.clientId}`} className="text-teal-700 hover:underline">
                          {row.clientName}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/services/${row.serviceId}`} className="text-teal-700 hover:underline">
                          {row.serviceDescription}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-stone-600">
                        {formatDate(row.startDate)} → {formatDate(row.endDate)}
                      </td>
                      <td className="px-4 py-2 font-medium text-stone-900">
                        {row.coin} {row.amount}
                      </td>
                      <td className="px-4 py-2 text-stone-600">{row.paymentState}</td>
                      <td className="px-4 py-2 text-stone-600">{row.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: "UTC" });
}
