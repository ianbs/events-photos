import "server-only";

import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/admin-authorization";
import { ApplicationError, forbiddenError, infrastructureError, validationError } from "@/lib/errors/application-error";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const deletionSchema = z.object({
  userId: z.string().uuid(),
  confirmation: z.string().trim().min(1).max(254),
});

export async function deleteAdminUser(input: unknown) {
  const actor = await requireSuperAdmin();
  const parsed = deletionSchema.safeParse(input);
  if (!parsed.success) throw validationError("Informe o usuário e a confirmação da exclusão.");
  const { userId, confirmation } = parsed.data;
  if (userId === actor.userId) throw validationError("Você não pode excluir a própria conta.");

  const client = createAdminSupabaseClient();
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error?.code === "user_not_found") return;
  if (error || !data.user) throw infrastructureError();
  const expected = data.user.email || data.user.id;
  if (confirmation.toLowerCase() !== expected.toLowerCase()) {
    throw validationError("A confirmação não corresponde ao e-mail ou identificador desta conta.");
  }

  const { data: membership, error: membershipError } = await client.from("admin_users")
    .select("role").eq("user_id", userId).maybeSingle();
  if (membershipError) throw infrastructureError();

  // Revalidate the actor under the existing access-management lock and revoke
  // administrative access before deletion, including if Auth later fails.
  const { error: accessError } = await client.rpc("manage_admin_access", {
    p_actor_id: actor.userId,
    p_user_id: userId,
    p_role: membership?.role === "super_admin" ? "super_admin" : "admin",
    p_is_active: false,
  });
  if (accessError?.code === "42501") throw forbiddenError("Seu acesso de superadministrador não está mais ativo.");
  if (accessError?.code === "22023") throw validationError("Você não pode excluir a própria conta.");
  if (accessError?.code === "23503") throw validationError("Esta conta foi alterada. Atualize a lista.");
  if (accessError) throw infrastructureError();

  try {
    const { error: deletionError } = await client.auth.admin.deleteUser(userId, false);
    if (deletionError && deletionError.code !== "user_not_found") throw deletionError;
  } catch {
    // Do not restore permissions after an ambiguous response: deletion may have
    // succeeded. Retrying a missing Auth user is intentionally idempotent.
    throw new ApplicationError("INFRASTRUCTURE_ERROR", 503,
      "O acesso ao painel foi bloqueado, mas não foi possível confirmar a exclusão da conta. Atualize a lista e tente novamente.");
  }
}
