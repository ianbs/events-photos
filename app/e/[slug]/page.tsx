import { notFound } from "next/navigation";

import { EventPhotoUploader } from "@/components/event-photo-uploader";
import { findActiveEventBySlug } from "@/lib/events/find-event-by-slug";

export const dynamic = "force-dynamic";

type EventPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await findActiveEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${event.eventDate}T00:00:00Z`));

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
          Galeria do evento
        </p>
        <h1 className="mt-2 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          {event.name}
        </h1>
        <p className="mt-2 text-slate-600">{formattedDate}</p>
        <p className="mt-5 max-w-lg text-center text-slate-600">
          Registre este momento e compartilhe sua foto com a família.
        </p>

        <EventPhotoUploader eventId={event.id} eventSlug={event.slug} />
      </div>
    </main>
  );
}
