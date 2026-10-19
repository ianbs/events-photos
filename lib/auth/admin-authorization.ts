import "server-only";

import { forbiddenError, infrastructureError, unauthorizedError } from "@/lib/errors/application-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminIdentity = {
  email: string | null;
  userId: string;
  role: "admin" | "super_admin";
};

type AdminLookup =
  | { kind: "anonymous" }
  | { kind: "forbidden" }
  | { admin: AdminIdentity; kind: "authorized" };

async function lookupCurrentAdmin(): Promise<AdminLookup> {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) return { kind: "anonymous" };

  const { data: membership, error: membershipError } = await supabase
    .from("admin_users")
    .select("user_id, role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) throw infrastructureError();
  if (!membership?.is_active || (membership.role !== "admin" && membership.role !== "super_admin")) {
    return { kind: "forbidden" };
  }

  return {
    admin: { email: user.email ?? null, userId: user.id, role: membership.role },
    kind: "authorized",
  };
}

export async function getCurrentAdmin(): Promise<AdminIdentity | null> {
  const result = await lookupCurrentAdmin();
  return result.kind === "authorized" ? result.admin : null;
}

export async function requireAdmin(): Promise<AdminIdentity> {
  const result = await lookupCurrentAdmin();
  if (result.kind === "anonymous") throw unauthorizedError();
  if (result.kind === "forbidden") throw forbiddenError("Usuário sem acesso administrativo.");
  return result.admin;
}

export async function requireSuperAdmin(): Promise<AdminIdentity> {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin") {
    throw forbiddenError("Somente superadministradores podem gerenciar usuários.");
  }
  return admin;
}
