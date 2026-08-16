import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { logoutAdmin } from "@/app/admin/actions";
import { getCurrentAdmin } from "@/lib/auth/admin-authorization";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-dvh bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Galeria do evento</p>
            <p className="text-xs text-slate-500">{admin.email}</p>
          </div>
          <form action={logoutAdmin}>
            <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
              Sair
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
