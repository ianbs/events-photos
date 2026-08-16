import "client-only";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnvironment } from "@/lib/config/public-environment";
import type { Database } from "@/types/database";

export function createBrowserSupabaseClient() {
  const environment = getPublicEnvironment();

  return createBrowserClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
