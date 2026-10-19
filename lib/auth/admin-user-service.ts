import "server-only";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { newPasswordSchema } from "@/lib/auth/password-recovery";
import { getPasswordRecoveryUrl, throwPasswordEmailError } from "@/lib/auth/password-email";
import { requireSuperAdmin } from "@/lib/auth/admin-authorization";
import { ApplicationError, conflictError, forbiddenError, infrastructureError, validationError } from "@/lib/errors/application-error";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const roleSchema = z.enum(["admin", "super_admin"]);
const createSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  role: roleSchema,
  passwordMode: z.enum(["manual", "email"]).default("email"),
  password: z.string().optional(),
  confirmation: z.string().optional(),
});
const accessSchema = z.object({
  userId: z.string().uuid(),
  role: roleSchema,
  isActive: z.boolean(),
});

function accessError(code?: string): never {
  if (code === "42501") throw forbiddenError("Seu acesso de superadministrador não está mais ativo.");
  if (code === "22023") throw validationError("Você não pode alterar o próprio acesso.");
  if (code === "23503") throw validationError("Usuário não encontrado. Atualize a lista.");
  throw infrastructureError();
}

export async function listAdminUsers(rawPage: unknown = 1) {
  await requireSuperAdmin();
  const parsed = z.coerce.number().int().min(1).max(100000).safeParse(rawPage);
  const page = parsed.success ? parsed.data : 1;
  const client = createAdminSupabaseClient();
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 30 });
  if (error) throw infrastructureError();
  const ids = data.users.map((user) => user.id);
  const { data: memberships, error: membershipError } = ids.length
    ? await client.from("admin_users").select("user_id, role, is_active").in("user_id", ids)
    : { data: [], error: null };
  if (membershipError) throw infrastructureError();
  const byId = new Map(memberships?.map((membership) => [membership.user_id, membership]));
  return {
    page,
    hasNext: data.nextPage != null,
    users: data.users.map((user) => {
      const membership = byId.get(user.id);
      return {
        id: user.id,
        email: user.email ?? "(sem e-mail)",
        role: membership?.role === "super_admin" ? "super_admin" as const : "admin" as const,
        isActive: membership?.is_active ?? false,
        hasAccess: Boolean(membership),
        createdAt: user.created_at,
      };
    }),
  };
}

export async function createAdminUser(input: unknown) {
  const actor = await requireSuperAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    throw validationError("Informe um e-mail válido e selecione o perfil.");
  }
  const password = parsed.data.passwordMode === "manual"
    ? readManualPassword(parsed.data) : randomBytes(32).toString("base64url") + "aA1!";
  const client = createAdminSupabaseClient();
  const { data, error } = await client.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.code === "user_already_exists") {
      throw conflictError("Este e-mail já possui conta. Localize o usuário na lista para liberar o acesso.");
    }
    if (error?.code === "weak_password") {
      throw validationError("A senha não atende aos requisitos de segurança. Escolha uma senha mais forte.");
    }
    throw infrastructureError();
  }
  const { error: accessFailure } = await client.rpc("manage_admin_access", {
    p_actor_id: actor.userId,
    p_user_id: data.user.id,
    p_role: parsed.data.role,
    p_is_active: true,
  });
  if (accessFailure) {
    // Leave the Auth account without membership: it cannot access administration.
    // It can be activated from the list after a partial or ambiguous failure.
    throw conflictError("A conta foi criada, mas o acesso não foi confirmado. Atualize a lista antes de tentar novamente.");
  }
  if (parsed.data.passwordMode === "manual") return { passwordMode: "manual" as const };
  try {
    const { error: emailError } = await client.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: getPasswordRecoveryUrl() });
    if (emailError) throwPasswordEmailError(emailError);
  } catch (error) {
    const detail = error instanceof ApplicationError ? error.message : "Não foi possível confirmar o envio.";
    throw conflictError("A conta foi criada, mas o e-mail não foi enviado ou confirmado. " + detail + " Defina a senha no painel ou use Enviar link para definir senha na lista.");
  }
  return { passwordMode: "email" as const };
}

export async function sendAdminUserPasswordEmail(untrustedId: unknown) {
  await requireSuperAdmin();
  const parsed = z.string().uuid().safeParse(untrustedId);
  if (!parsed.success) throw validationError("Usuário inválido.");
  const client = createAdminSupabaseClient();
  const { data: membership, error: membershipError } = await client.from("admin_users")
    .select("is_active").eq("user_id", parsed.data).maybeSingle();
  if (membershipError) throw infrastructureError();
  if (!membership?.is_active) throw validationError("Ative o acesso desta conta antes de enviar o link.");
  const { data, error } = await client.auth.admin.getUserById(parsed.data);
  if (error || !data.user?.email) throw validationError("Não foi possível localizar o e-mail desta conta.");
  const { error: emailError } = await client.auth.resetPasswordForEmail(data.user.email, { redirectTo: getPasswordRecoveryUrl() });
  if (emailError) throwPasswordEmailError(emailError);
}

export async function updateAdminUserAccess(input: unknown) {
  const actor = await requireSuperAdmin();
  const parsed = accessSchema.safeParse(input);
  if (!parsed.success) throw validationError("Dados de acesso inválidos.");
  if (actor.userId === parsed.data.userId) {
    throw validationError("Você não pode alterar o próprio acesso.");
  }
  const client = createAdminSupabaseClient();
  const { error } = await client.rpc("manage_admin_access", {
    p_actor_id: actor.userId,
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
    p_is_active: parsed.data.isActive,
  });
  if (error) accessError(error.code);
}

function readManualPassword(input: unknown) {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw validationError(issue.code === "invalid_type" ? "Informe e confirme a nova senha." : issue.message);
  }
  return parsed.data.password;
}

export async function setAdminUserPassword(input: unknown) {
  await requireSuperAdmin();
  const parsed = z.object({
    userId: z.string().uuid(),
    password: z.string(),
    confirmation: z.string(),
  }).safeParse(input);
  if (!parsed.success) throw validationError("Informe o usuário, a nova senha e sua confirmação.");
  const password = readManualPassword(parsed.data);
  const { error } = await createAdminSupabaseClient().auth.admin.updateUserById(parsed.data.userId, { password });
  if (error?.code === "user_not_found") throw validationError("Usuário não encontrado. Atualize a lista.");
  if (error?.code === "weak_password") throw validationError("A senha não atende aos requisitos de segurança. Use uma senha mais forte.");
  if (error?.code === "same_password") throw validationError("Escolha uma senha diferente da senha atual.");
  if (error) throw infrastructureError();
}
