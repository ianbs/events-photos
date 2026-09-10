import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

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

function formatBytes(value: number): string {
  if (value === 0) {
    return "0 MB";
  }

  if (value >= 1024 ** 3) {
    return `${(value / 1024 ** 3).toFixed(1)} GB`;
  }

  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

function formatLastUpload(value: string | null): string {
  if (!value) {
    return "Nenhum envio";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

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

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">
            Administração
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Eventos e fotos</h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-slate-600">{totalPhotos} foto(s)</p>
          <Link
            href="/admin/events/new"
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Novo evento
          </Link>
        </div>
      </div>

      {eventsWithQrCode.length > 0 ? (
        <section className="mt-7 grid gap-4 lg:grid-cols-2">
          {eventsWithQrCode.map((event) => (
            <article
              key={event.id}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex gap-4">
                <Image
                  src={event.qrCodeDataUrl}
                  alt={`QR Code para ${event.name}`}
                  width={128}
                  height={128}
                  unoptimized
                  className="h-28 w-28 shrink-0 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold">{event.name}</p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                        event.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {event.isActive ? "Ativo" : "Encerrado"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <p><span className="font-semibold">{event.photoCount}</span> fotos</p>
                    <p><span className="font-semibold">{event.guestCount}</span> dispositivos</p>
                    <p>{formatBytes(event.storageBytes)}</p>
                    <p className="truncate" title={formatLastUpload(event.lastPhotoAt)}>
                      {formatLastUpload(event.lastPhotoAt)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-sm">
                <a href={event.eventUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
                  Abrir evento
                </a>
                <Link href={`/admin/events/${event.id}/edit`} className="text-emerald-700 underline">
                  Editar evento
                </Link>
                <a href={event.qrCodeDataUrl} download={`qr-${event.slug}.png`} className="text-slate-700 underline">
                  Baixar QR Code
                </a>
                {event.photoCount > 0 ? (
                  <a href={`/api/admin/events/${event.id}/photos.zip`} className="font-medium text-emerald-700 underline">
                    Baixar todas em ZIP
                  </a>
                ) : (
                  <span className="text-slate-400">ZIP indisponível</span>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="mt-10">
        <div className="mb-5">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">
            Acervo
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Fotos</h2>
        </div>

        <form method="get" className="mb-6 grid gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-5">
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
