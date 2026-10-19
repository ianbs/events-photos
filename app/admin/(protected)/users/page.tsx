import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminUserAccessForm, AdminUserManualPasswordForm, AdminUserPasswordEmailForm, CreateAdminUserForm, DeleteAdminUserForm } from "@/components/admin-user-forms";
import { getCurrentAdmin } from "@/lib/auth/admin-authorization";
import { listAdminUsers } from "@/lib/auth/admin-user-service";
import { ApplicationError } from "@/lib/errors/application-error";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.role !== "super_admin") redirect("/admin");
  const { page, status } = await searchParams;
  let result;
  try {
    result = await listAdminUsers(page ?? 1);
  } catch (error) {
    if (error instanceof ApplicationError && (error.status === 401 || error.status === 403)) redirect("/admin");
    return <main className="mx-auto max-w-6xl px-4 py-8"><h1 className="text-3xl font-semibold">Usuários e acessos</h1><p role="alert" className="mt-5 text-red-700">Não foi possível carregar os usuários. Atualize a página para tentar novamente.</p></main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">Superadministração</p>
      <h1 className="mt-1 text-3xl font-semibold">Usuários e acessos</h1>
      <p className="mt-3 max-w-3xl text-sm text-slate-600">
        Administradores gerenciam todos os eventos, fotos e convidados. Superadministradores também cadastram usuários e controlam permissões.
        Ao desativar o acesso, a conta perde acesso ao painel e às operações administrativas na próxima solicitação.
      </p>
      {status === "deleted" ? <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Usuário excluído com sucesso.</p> : null}
      <section aria-labelledby="create-user-title" className="mt-7 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 id="create-user-title" className="text-xl font-semibold">Novo usuário</h2>
        <CreateAdminUserForm />
      </section>
      <section aria-labelledby="users-title" className="mt-8">
        <h2 id="users-title" className="text-xl font-semibold">Contas cadastradas</h2>
        <p className="mt-2 text-sm text-slate-600">Contas sem acesso também aparecem aqui para você autorizar. Desmarque “Acesso ativo” para bloquear o painel.</p>
        <div className="mt-4 space-y-4">
          {result.users.map((user) => (
            <article key={`${user.id}-${user.role}-${user.isActive}`} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="break-all font-semibold">{user.email}{user.id === admin.userId ? " (você)" : ""}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${user.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                  {user.isActive ? "Ativo" : user.hasAccess ? "Bloqueado" : "Sem acesso"}
                </span>
              </div>
              <AdminUserAccessForm userId={user.id} role={user.role} isActive={user.isActive} isSelf={user.id === admin.userId} />
              <AdminUserManualPasswordForm userId={user.id} isActive={user.isActive} />
              <AdminUserPasswordEmailForm userId={user.id} isActive={user.isActive} />
              <DeleteAdminUserForm userId={user.id} email={user.email === "(sem e-mail)" ? null : user.email} isSelf={user.id === admin.userId} />
            </article>
          ))}
          {result.users.length === 0 ? <p className="rounded-xl bg-white p-5 text-sm text-slate-600">Nenhuma conta nesta página.</p> : null}
        </div>
        <nav aria-label="Páginas de usuários" className="mt-5 flex items-center justify-between gap-4 text-sm">
          {result.page > 1 ? <Link className="underline" href={`/admin/users?page=${result.page - 1}`}>Anterior</Link> : <span />}
          <span>Página {result.page}</span>
          {result.hasNext ? <Link className="underline" href={`/admin/users?page=${result.page + 1}`}>Próxima</Link> : <span />}
        </nav>
      </section>
    </main>
  );
}
