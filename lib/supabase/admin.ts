import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getAdminEnvironment } from "@/lib/config/server-environment";
import type { Database } from "@/types/database";

export function createAdminSupabaseClient() {
  const environment = getAdminEnvironment();

  return createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_ADMIN_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
