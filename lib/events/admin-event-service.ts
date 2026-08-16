import "server-only";

import { requireAdmin } from "@/lib/auth/admin-authorization";
import { infrastructureError } from "@/lib/errors/application-error";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AdminEvent = {
  eventDate: string;
  id: string;
  isActive: boolean;
  name: string;
  slug: string;
};

export async function listAdminEvents(): Promise<AdminEvent[]> {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("id,name,slug,event_date,is_active")
    .order("event_date", { ascending: false });

  if (error) {
    throw infrastructureError();
  }

  return (data ?? []).map((event) => ({
    eventDate: event.event_date,
    id: event.id,
    isActive: event.is_active,
    name: event.name,
    slug: event.slug,
  }));
}
