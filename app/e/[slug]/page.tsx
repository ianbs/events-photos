import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { EventPublicHeader } from "@/components/event-public-header";
import { EventPhotoUploader } from "@/components/event-photo-uploader";
import { findActiveEventBySlug } from "@/lib/events/find-event-by-slug";

export const dynamic = "force-dynamic";

type EventPageProps = {
  params: Promise<{ slug: string }>;
};

type EventThemeStyle = CSSProperties & {
  "--event-accent": string;
  "--event-primary": string;
};

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await findActiveEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const themeStyle: EventThemeStyle = {
    "--event-accent": event.accentColor,
    "--event-primary": event.primaryColor,
  };

  return (
    <main
      className="min-h-dvh bg-slate-50 px-4 pb-8 sm:px-6"
      style={themeStyle}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <EventPublicHeader event={event} label="Galeria do evento" description="Registre este momento e compartilhe sua foto com a família." />
        <Link href={`/e/${event.slug}/save-the-date`} className="mt-4 text-sm text-[var(--event-primary)] underline">
          Save the date e confirmação de presença
        </Link>

        <EventPhotoUploader eventId={event.id} eventSlug={event.slug} />
      </div>
    </main>
  );
}
