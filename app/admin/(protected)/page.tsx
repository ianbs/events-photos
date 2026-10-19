import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminEventList } from "@/components/admin-event-list";
import { AdminPhotoGrid } from "@/components/admin-photo-grid";
import { getCurrentAdmin } from "@/lib/auth/admin-authorization";
import { listAdminEventSummaries } from "@/lib/events/admin-event-service";
import { createEventQrCode } from "@/lib/events/event-qr-code";
import {
  listAdminPhotos,
  normalizeAdminPhotoFilters,
} from "@/lib/photos/admin-photo-service";

type AdminDashboardPageProps = {
  searchParams: Promise<{
    cursor?: string;
    event?: string;
    from?: string;
    sort?: string;
    status?: string;
    to?: string;
  }>;
};

function createPhotoPageHref(
  filters: ReturnType<typeof normalizeAdminPhotoFilters>,
  cursor: string | null,
) {
  const params = new URLSearchParams();

  if (filters.eventId) params.set("event", filters.eventId);
  if (filters.fromDate) params.set("from", filters.fromDate);
  if (filters.toDate) params.set("to", filters.toDate);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (cursor) params.set("cursor", cursor);

  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const rawFilters = await searchParams;
  const filters = normalizeAdminPhotoFilters(rawFilters);
  const [photoPage, events] = await Promise.all([
    listAdminPhotos(filters),
    listAdminEventSummaries(),
  ]);
  const eventFeedback =
    rawFilters.status === "created"
      ? "Evento criado com sucesso."
      : rawFilters.status === "deleted"
        ? "Evento excluído com sucesso."
      : rawFilters.status === "updated"
        ? "Evento atualizado com sucesso."
        : null;
  const eventsWithQrCode = await Promise.all(
    events.map(async (event) => ({
      ...event,
      ...(await createEventQrCode(event.slug)),
    })),
  );
  const totalPhotos = events.reduce((sum, event) => sum + event.photoCount, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {eventFeedback ? (
        <p className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {eventFeedback}
        </p>
      ) : null}

      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Visão geral</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Eventos</h1>
          <p className="mt-2 text-sm text-slate-500">Organize os convidados, acompanhe as presenças e reúna as fotos.</p>
        </div>
        <Link href="/admin/events/new" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
          <span aria-hidden="true" className="text-xl leading-none font-normal">+</span> Novo evento
        </Link>
      </div>

      <dl className="mt-7 grid grid-cols-3 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white py-5">
        {[
          { label: "Total de eventos", value: events.length },
          { label: "Eventos ativos", value: events.filter((event) => event.isActive).length },
          { label: "Fotos recebidas", value: totalPhotos },
        ].map((item) => (
          <div key={item.label} className="px-3 sm:px-6">
            <dt className="text-xs text-slate-500 sm:text-sm">{item.label}</dt>
            <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{item.value.toLocaleString("pt-BR")}</dd>
          </div>
        ))}
      </dl>

      <AdminEventList events={eventsWithQrCode} />

      <section id="photos" className="mt-12 scroll-mt-6 border-t border-slate-200 pt-8">
        <div className="mb-5">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">
            Acervo
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Fotos</h2>
        </div>

        <form key={[filters.eventId, filters.fromDate, filters.toDate, filters.sort].join(":")} method="get" className="mb-6 grid gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block lg:col-span-2">
            <span className="text-xs font-medium text-slate-600">Evento</span>
            <select name="event" defaultValue={filters.eventId ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
              <option value="">Todos os eventos</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">De</span>
            <input name="from" type="date" defaultValue={filters.fromDate ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Até</span>
            <input name="to" type="date" defaultValue={filters.toDate ?? ""} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Ordenação</span>
            <select name="sort" defaultValue={filters.sort} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigas</option>
            </select>
          </label>
          <div className="flex gap-3 sm:col-span-2 lg:col-span-5">
            <button type="submit" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white">
              Aplicar filtros
            </button>
            <Link href="/admin" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700">
              Limpar
            </Link>
          </div>
        </form>

        <AdminPhotoGrid photos={photoPage.photos} totalCount={photoPage.totalCount} />

        {filters.cursor || photoPage.nextCursor ? (
          <nav aria-label="Paginação das fotos" className="mt-6 flex items-center justify-between gap-4">
            {filters.cursor ? (
              <Link href={createPhotoPageHref(filters, null)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700">
                Voltar à primeira página
              </Link>
            ) : <span />}
            {photoPage.nextCursor ? (
              <Link href={createPhotoPageHref(filters, photoPage.nextCursor)} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white">
                Próxima página
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
