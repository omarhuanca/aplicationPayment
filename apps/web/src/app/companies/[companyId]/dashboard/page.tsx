"use client";

import { useParams } from "next/navigation";
import { useDashboardSummary } from "@/lib/queries";

export default function DashboardPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { data, isLoading } = useDashboardSummary(companyId);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-stone-900">Dashboard</h1>

      {isLoading || !data ? (
        <p className="text-sm text-stone-500">Cargando…</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Pagos pendientes" value={data.pendingCount} tone="neutral" />
          <SummaryCard label="Pagos vencidos" value={data.overdueCount} tone="warn" />
          <SummaryCard label="Clientes activos" value={data.activeClients} tone="neutral" />
          <SummaryCard label="Ingresos del mes" value={`$${data.incomeThisMonth}`} tone="good" />
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "neutral" | "warn" | "good";
}) {
  const toneClass =
    tone === "warn" ? "text-amber-700" : tone === "good" ? "text-teal-700" : "text-stone-900";

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
