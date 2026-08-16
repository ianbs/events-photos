import Link from "next/link";
import { notFound } from "next/navigation";

import { EditEventForm } from "@/components/edit-event-form";
import { EventBrandingForm } from "@/components/event-branding-form";
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
            eventDate: event.eventDate,
            isActive: event.isActive,
            name: event.name,
            slug: event.slug,
          }}
        />
      </section>
      <EventBrandingForm
        eventId={event.id}
        eventName={event.name}
        initialAccentColor={event.accentColor}
        initialCoverImageUrl={event.coverImageUrl}
        initialLogoImageUrl={event.logoImageUrl}
        initialPrimaryColor={event.primaryColor}
      />
    </main>
  );
}
