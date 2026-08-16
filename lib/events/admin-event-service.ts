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

const eventColumns = "id,name,slug,event_date,is_active" as const;

export type AdminEvent = {
  eventDate: string;
  id: string;
  isActive: boolean;
  name: string;
  slug: string;
};

export type EditableAdminEvent = AdminEvent & {
  accentColor: string;
  coverImageUrl: string | null;
  logoImageUrl: string | null;
  primaryColor: string;
};

type StoredAdminEvent = {
  event_date: string;
  id: string;
  is_active: boolean;
  name: string;
  slug: string;
};

function mapAdminEvent(event: StoredAdminEvent): AdminEvent {
  return {
    eventDate: event.event_date,
    id: event.id,
    isActive: event.is_active,
    name: event.name,
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
    event_date: input.eventDate,
    is_active: input.isActive,
    name: input.name,
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
