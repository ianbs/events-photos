"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentAdmin } from "@/lib/auth/admin-authorization";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAdmin(formData: FormData) {
  const input = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!input.success) {
    redirect("/admin/login?error=invalid");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(input.data);

  if (error) {
    redirect("/admin/login?error=invalid");
  }

  const admin = await getCurrentAdmin();

  if (!admin) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=forbidden");
  }

  redirect("/admin");
}

export async function logoutAdmin() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
