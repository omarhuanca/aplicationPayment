"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCompany } from "@/lib/queries";

const NAV_LINKS = [
  { segment: "dashboard", label: "Dashboard" },
  { segment: "clients", label: "Clientes" },
  { segment: "reports", label: "Reportes" },
];

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const { companyId } = useParams<{ companyId: string }>();
  const pathname = usePathname();
  const { data: company } = useCompany(companyId);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-stone-900">{company?.name ?? "Gestor de Cobros"}</span>
            <nav className="flex gap-4 text-sm">
              {NAV_LINKS.map((link) => {
                const href = `/companies/${companyId}/${link.segment}`;
                return (
                  <Link
                    key={link.segment}
                    href={href}
                    className={
                      pathname.startsWith(href) ? "font-medium text-teal-700" : "text-stone-500 hover:text-stone-800"
                    }
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <Link href="/companies" className="text-sm font-medium text-stone-700 hover:text-teal-700">
            Cambiar de empresa
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
