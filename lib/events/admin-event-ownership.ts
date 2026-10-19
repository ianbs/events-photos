import "server-only";

import { requireAdmin } from "@/lib/auth/admin-authorization";
import { infrastructureError, notFoundError } from "@/lib/errors/application-error";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function requireOwnedAdminEvent(eventId: string) {
  const actor = await requireAdmin();
  const { data, error } = await createAdminSupabaseClient()
    .from("events").select("id").eq("id", eventId)
    .eq("owner_id", actor.userId).maybeSingle();
  if (error) throw infrastructureError();
  if (!data) throw notFoundError("Evento não encontrado.");
}
