import Image from "next/image";
import { redirect } from "next/navigation";

import { AdminPhotoGrid } from "@/components/admin-photo-grid";
import { getCurrentAdmin } from "@/lib/auth/admin-authorization";
import { listAdminEvents } from "@/lib/events/admin-event-service";
import { createEventQrCode } from "@/lib/events/event-qr-code";
import { listAdminPhotos } from "@/lib/photos/admin-photo-service";

export default async function AdminDashboardPage() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const [photos, events] = await Promise.all([
    listAdminPhotos(),
    listAdminEvents(),
  ]);
  const eventsWithQrCode = await Promise.all(
    events.map(async (event) => ({
      ...event,
      ...(await createEventQrCode(event.slug)),
    })),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">
            Administração
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Todas as fotos</h1>
        </div>
        <p className="text-sm text-slate-600">{photos.length} foto(s)</p>
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
                <a href={event.qrCodeDataUrl} download={`qr-${event.slug}.png`} className="mt-2 block text-sm text-slate-700 underline">
                  Baixar QR Code
                </a>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="mt-8">
        <AdminPhotoGrid photos={photos} />
      </section>
    </main>
  );
}
