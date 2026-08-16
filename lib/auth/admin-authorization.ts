import "server-only";

import {
  forbiddenError,
  infrastructureError,
  unauthorizedError,
} from "@/lib/errors/application-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminIdentity = {
  email: string | null;
  userId: string;
};

type AdminLookup =
  | { kind: "anonymous" }
  | { kind: "forbidden" }
  | { admin: AdminIdentity; kind: "authorized" };

async function lookupCurrentAdmin(): Promise<AdminLookup> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { kind: "anonymous" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    throw infrastructureError();
  }

  if (!membership) {
    return { kind: "forbidden" };
  }

  return {
    admin: { email: user.email ?? null, userId: user.id },
    kind: "authorized",
  };
}

export async function getCurrentAdmin(): Promise<AdminIdentity | null> {
  const result = await lookupCurrentAdmin();
  return result.kind === "authorized" ? result.admin : null;
}

export async function requireAdmin(): Promise<AdminIdentity> {
  const result = await lookupCurrentAdmin();

  if (result.kind === "anonymous") {
    throw unauthorizedError();
  }

  if (result.kind === "forbidden") {
    throw forbiddenError("Usuário sem acesso administrativo.");
  }

  return result.admin;
}
