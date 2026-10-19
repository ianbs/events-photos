import Link from "next/link";
import { notFound } from "next/navigation";

import { EditEventForm } from "@/components/edit-event-form";
import { EventBrandingForm } from "@/components/event-branding-form";
import { EventMusicForm } from "@/components/event-music-form";
import { ApplicationError } from "@/lib/errors/application-error";
import { findAdminEventById } from "@/lib/events/admin-event-service";

type EditAdminEventPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function EditAdminEventPage({
  params,
}: EditAdminEventPageProps) {
  const { eventId } = await params;
  let event;

  try {
    event = await findAdminEventById(eventId);
  } catch (error) {
    if (error instanceof ApplicationError && error.code === "NOT_FOUND") {
      notFound();
    }

    throw error;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-sm text-emerald-700 underline">
        Voltar para a administração
      </Link>
      <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">
          Eventos
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Editar evento</h1>
        <p className="mt-2 text-sm text-slate-600">
          Atualize as informações ou desative temporariamente o acesso dos
          convidados.
        </p>
        <EditEventForm
          eventId={event.id}
          initialValues={{
            instructions: event.instructions,
            whatsappMessage: event.whatsappMessage,
            availabilityUntil: event.availabilityUntil,
            closingMessage: event.closingMessage,
            eventDate: event.eventDate,
            isActive: event.isActive,
            name: event.name,
            location: event.location,
            mapsUrl: event.mapsUrl,
            maxCompanions: event.maxCompanions,
            organizerContact: event.organizerContact,
            slug: event.slug,
          }}
        />
      </section>
      <EventMusicForm
        eventId={event.id}
        initialMusicUrl={event.musicUrl}
        hasMusic={event.hasMusic}
      />
      <EventBrandingForm
        eventId={event.id}
        eventName={event.name}
        initialAccentColor={event.accentColor}
        initialCoverImageUrl={event.coverImageUrl}
        initialLogoImageUrl={event.logoImageUrl}
        initialPrimaryColor={event.primaryColor}
      />
      <section className="mt-8 rounded-2xl border border-red-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Excluir evento</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Remova definitivamente este evento e seus dados, incluindo fotos, convidados e confirmações de presença.</p>
        <Link href={`/admin/events/${event.id}/delete`} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">Excluir evento…</Link>
      </section>
    </main>
  );
}
