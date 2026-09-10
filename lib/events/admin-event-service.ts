import "server-only";

import { requireAdmin } from "@/lib/auth/admin-authorization";
import {
  conflictError,
  infrastructureError,
  notFoundError,
  validationError,
} from "@/lib/errors/application-error";
import {
  createEventSchema,
  eventIdSchema,
  type EventInput,
} from "@/lib/events/event-validation";
import { createEventBrandingUrls } from "@/lib/events/event-branding-storage";
import { eventBrandingColorsSchema } from "@/lib/events/event-branding-policy";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const eventColumns =
  "id,name,slug,event_date,is_active,closing_message,photos_available_until,organizer_contact" as const;

export type AdminEvent = {
  availabilityUntil: string | null;
  closingMessage: string;
  eventDate: string;
  id: string;
  isActive: boolean;
  name: string;
  organizerContact: string | null;
  slug: string;
};

export type EditableAdminEvent = AdminEvent & {
  accentColor: string;
  coverImageUrl: string | null;
  logoImageUrl: string | null;
  primaryColor: string;
};

export type AdminEventSummary = AdminEvent & {
  guestCount: number;
  lastPhotoAt: string | null;
  photoCount: number;
  storageBytes: number;
};

type StoredAdminEvent = {
  closing_message: string;
  event_date: string;
  id: string;
  is_active: boolean;
  name: string;
  organizer_contact: string | null;
  photos_available_until: string | null;
  slug: string;
};

function mapAdminEvent(event: StoredAdminEvent): AdminEvent {
  return {
    availabilityUntil: event.photos_available_until,
    closingMessage: event.closing_message,
    eventDate: event.event_date,
    id: event.id,
    isActive: event.is_active,
    name: event.name,
    organizerContact: event.organizer_contact,
    slug: event.slug,
  };
}

function validateEventId(untrustedEventId: string): string {
  const eventId = eventIdSchema.safeParse(untrustedEventId);

  if (!eventId.success) {
    throw notFoundError("Evento não encontrado.");
  }

  return eventId.data;
}

function validateEventInput(untrustedInput: unknown): EventInput {
  const input = createEventSchema.safeParse(untrustedInput);

  if (!input.success) {
    throw validationError("Revise os dados do evento.");
  }

  return input.data;
}

function toStoredEventInput(input: EventInput) {
  return {
    closing_message: input.closingMessage,
    event_date: input.eventDate,
    is_active: input.isActive,
    name: input.name,
    organizer_contact: input.organizerContact,
    photos_available_until: input.availabilityUntil,
    slug: input.slug,
  };
}

function throwEventWriteError(error: { code?: string } | null): void {
  if (error?.code === "23505") {
    throw conflictError("Este endereço do evento já está em uso.");
  }

  if (error) {
    throw infrastructureError();
  }
}

export async function createAdminEvent(
  untrustedInput: unknown,
): Promise<AdminEvent> {
  await requireAdmin();
  const input = validateEventInput(untrustedInput);

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .insert(toStoredEventInput(input))
    .select(eventColumns)
    .single();

  throwEventWriteError(error);

  if (!data) {
    throw infrastructureError();
  }

  return mapAdminEvent(data);
}

export async function findAdminEventById(
  untrustedEventId: string,
): Promise<EditableAdminEvent> {
  await requireAdmin();
  const eventId = validateEventId(untrustedEventId);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      `${eventColumns},primary_color,accent_color,cover_storage_path,logo_storage_path`,
    )
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    throw infrastructureError();
  }

  if (!data) {
    throw notFoundError("Evento não encontrado.");
  }

  const urls = await createEventBrandingUrls(
    data.cover_storage_path,
    data.logo_storage_path,
  );
  const colors = eventBrandingColorsSchema.safeParse({
    accentColor: data.accent_color,
    primaryColor: data.primary_color,
  });

  if (!colors.success) {
    throw infrastructureError();
  }

  return {
    ...mapAdminEvent(data),
    ...colors.data,
    ...urls,
  };
}

export async function updateAdminEvent(
  untrustedEventId: string,
  untrustedInput: unknown,
): Promise<AdminEvent> {
  await requireAdmin();
  const eventId = validateEventId(untrustedEventId);
  const input = validateEventInput(untrustedInput);

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .update(toStoredEventInput(input))
    .eq("id", eventId)
    .select(eventColumns)
    .maybeSingle();

  throwEventWriteError(error);

  if (!data) {
    throw notFoundError("Evento não encontrado.");
  }

  return mapAdminEvent(data);
}

export async function listAdminEvents(): Promise<AdminEvent[]> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select(eventColumns)
    .order("event_date", { ascending: false });

  if (error) {
    throw infrastructureError();
  }

  return (data ?? []).map(mapAdminEvent);
}

export async function listAdminEventSummaries(): Promise<AdminEventSummary[]> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const [{ data: events, error: eventsError }, { data: summaries, error: summariesError }] =
    await Promise.all([
      supabase
        .from("events")
        .select(eventColumns)
        .order("event_date", { ascending: false }),
      supabase.from("event_admin_summaries").select(
        "event_id,photo_count,guest_count,storage_bytes,last_photo_at",
      ),
    ]);

  if (eventsError || summariesError) {
    throw infrastructureError();
  }

  const summariesByEventId = new Map(
    (summaries ?? []).flatMap((summary) =>
      summary.event_id ? [[summary.event_id, summary] as const] : [],
    ),
  );

  return (events ?? []).map((storedEvent) => {
    const event = mapAdminEvent(storedEvent);
    const summary = summariesByEventId.get(event.id);

    return {
      ...event,
      guestCount: summary?.guest_count ?? 0,
      lastPhotoAt: summary?.last_photo_at ?? null,
      photoCount: summary?.photo_count ?? 0,
      storageBytes: summary?.storage_bytes ?? 0,
    };
  });
}
