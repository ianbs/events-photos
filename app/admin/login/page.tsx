import { redirect } from "next/navigation";

import { loginAdmin } from "@/app/admin/actions";
import { getCurrentAdmin } from "@/lib/auth/admin-authorization";

export const dynamic = "force-dynamic";

type AdminLoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const [admin, params] = await Promise.all([getCurrentAdmin(), searchParams]);

  if (admin) {
    redirect("/admin");
  }

  const errorMessage =
    params.error === "forbidden"
      ? "Este usuário não está autorizado como administrador."
      : params.error
        ? "E-mail ou senha inválidos."
        : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">
          Administração
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Entrar</h1>
        <p className="mt-3 text-sm text-slate-600">
          Use o usuário criado manualmente no Supabase Auth.
        </p>

        {errorMessage ? (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <form action={loginAdmin} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            E-mail
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block text-sm font-medium">
            Senha
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="submit"
            className="min-h-12 w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
          >
            Entrar no painel
          </button>
        </form>
      </div>
    </main>
  );
}
