import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPhotoGrid } from "@/components/admin-photo-grid";
import { getCurrentAdmin } from "@/lib/auth/admin-authorization";
import { listAdminEvents } from "@/lib/events/admin-event-service";
import { createEventQrCode } from "@/lib/events/event-qr-code";
import { listAdminPhotos } from "@/lib/photos/admin-photo-service";

type AdminDashboardPageProps = {
  searchParams: Promise<{ event?: string }>;
};

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const [photos, events] = await Promise.all([
    listAdminPhotos(),
    listAdminEvents(),
  ]);
  const { event: eventStatus } = await searchParams;
  const eventFeedback =
    eventStatus === "created"
      ? "Evento criado com sucesso."
      : eventStatus === "updated"
        ? "Evento atualizado com sucesso."
        : null;
  const eventsWithQrCode = await Promise.all(
    events.map(async (event) => ({
      ...event,
      ...(await createEventQrCode(event.slug)),
    })),
  );

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
          <p className="text-sm text-slate-600">{photos.length} foto(s)</p>
          <Link
            href="/admin/events/new"
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Novo evento
          </Link>
        </div>
      </div>

      {eventsWithQrCode.length > 0 ? (
        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventsWithQrCode.map((event) => (
            <article key={event.id} className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <Image
                src={event.qrCodeDataUrl}
                alt={`QR Code para ${event.name}`}
                width={128}
                height={128}
                unoptimized
                className="h-28 w-28 rounded-lg"
              />
              <div className="min-w-0">
                <p className="truncate font-semibold">{event.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {event.isActive ? "Ativo" : "Inativo"}
                </p>
                <a href={event.eventUrl} target="_blank" rel="noreferrer" className="mt-3 block text-sm text-emerald-700 underline">
                  Abrir evento
                </a>
                <Link href={`/admin/events/${event.id}/edit`} className="mt-2 block text-sm text-emerald-700 underline">
                  Editar evento
                </Link>
                <a href={event.qrCodeDataUrl} download={`qr-${event.slug}.png`} className="mt-2 block text-sm text-slate-700 underline">
                  Baixar QR Code
                </a>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-5">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">
            Acervo
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Fotos por evento</h2>
        </div>
        <AdminPhotoGrid photos={photos} />
      </section>
    </main>
  );
}
