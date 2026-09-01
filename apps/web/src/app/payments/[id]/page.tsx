"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { usePayment } from "@/lib/queries";
import { apiDownload, ApiError } from "@/lib/api-client";

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: payment, isLoading } = usePayment(id);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"image" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExportImage() {
    if (!receiptRef.current) return;
    setExportError(null);
    setExporting("image");
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(receiptRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("No se pudo generar la imagen");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pago-${id}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("No se pudo exportar la imagen");
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPdf() {
    setExportError(null);
    setExporting("pdf");
    try {
      await apiDownload(`/payments/${id}/export.pdf`, `pago-${id}.pdf`);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : "No se pudo exportar el PDF");
    } finally {
      setExporting(null);
    }
  }

  if (isLoading || !payment) {
    return <p className="p-8 text-sm text-stone-500">Cargando…</p>;
  }

  const { offeredService: service } = payment;
  const { client } = service;
  const { company } = client;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/services/${service.id}`} className="text-sm text-teal-700 hover:underline">
            ← {service.description}
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-stone-900">Detalle del pago</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportImage}
            disabled={exporting !== null}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
          >
            {exporting === "image" ? "Exportando..." : "Exportar imagen"}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting !== null}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
          >
            {exporting === "pdf" ? "Exportando..." : "Exportar PDF"}
          </button>
        </div>
      </div>

      {exportError && <p className="text-sm text-red-600">{exportError}</p>}

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <Section title="Empresa">
          <Field label="Nombre" value={company.name} />
          <Field label="Dirección" value={company.address} />
        </Section>

        <Section title="Cliente">
          <Field
            label="Nombre completo"
            value={
              <Link href={`/companies/${company.id}/clients/${client.id}`} className="text-teal-700 hover:underline">
                {client.fullname}
              </Link>
            }
          />
        </Section>

        <Section title="Servicio">
          <Field
            label="Descripción"
            value={
              <Link href={`/services/${service.id}`} className="text-teal-700 hover:underline">
                {service.description}
              </Link>
            }
          />
          <Field label="Precio" value={`${service.coin} ${service.price}`} />
          <Field label="Periodicidad" value={service.billingPeriod} />
        </Section>

        <Section title="Pago" last>
          <Field label="Período" value={`${formatDate(payment.startDate)} → ${formatDate(payment.endDate)}`} />
          <Field label="Monto" value={`${service.coin} ${payment.amount}`} />
          <Field label="Método" value={payment.paymentMethod} />
        </Section>
      </div>

      {/* Plantilla oculta usada solo para "Exportar imagen": recibo angosto de
          80mm con el mismo formato que el PDF, pensado para impresoras
          térmicas (Epson TM-T20 y compatibles). No se muestra en pantalla. */}
      <div style={{ position: "fixed", top: 0, left: -9999 }} aria-hidden="true">
        <div ref={receiptRef} className="w-[302px] bg-white p-3 font-mono text-black">
          <p className="text-center text-[13px] font-bold">{company.name}</p>
          <p className="text-center text-[10px]">{company.address}</p>
          <hr className="my-2 border-t border-black" />
          <p className="text-center text-[11px] font-bold">DETALLE DE PAGO</p>
          <hr className="my-2 border-t border-black" />
          <p className="text-[10px] leading-relaxed">Cliente: {client.fullname}</p>
          <p className="text-[10px] leading-relaxed">Servicio: {service.description}</p>
          <p className="text-[10px] leading-relaxed">
            Precio: {service.coin} {service.price}
          </p>
          <p className="text-[10px] leading-relaxed">Periodicidad: {service.billingPeriod}</p>
          <hr className="my-2 border-t border-black" />
          <p className="text-[10px] leading-relaxed">
            Periodo: {formatDate(payment.startDate)} - {formatDate(payment.endDate)}
          </p>
          <p className="text-[12px] font-bold leading-relaxed">
            Monto: {service.coin} {payment.amount}
          </p>
          <p className="text-[10px] leading-relaxed">Metodo: {payment.paymentMethod}</p>
          <hr className="my-2 border-t border-black" />
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`p-4 ${last ? "" : "border-b border-stone-200"}`}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
      <dl className="space-y-1">{children}</dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-900">{value}</dd>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: "UTC" });
}
