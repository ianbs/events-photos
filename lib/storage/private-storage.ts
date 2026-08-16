import "server-only";

import { infrastructureError } from "@/lib/errors/application-error";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function readPrivateStorageObjectHeader(
  bucket: string,
  path: string,
): Promise<Uint8Array> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60);

  if (error || !data) {
    throw infrastructureError();
  }

  try {
    const response = await fetch(data.signedUrl, {
      headers: { Range: "bytes=0-63" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok || !response.body) {
      throw new Error("Storage did not return the requested object");
    }

    const reader = response.body.getReader();
    const { value } = await reader.read();
    await reader.cancel();

    if (!value) {
      throw new Error("Storage returned an empty object");
    }

    return value.slice(0, 64);
  } catch {
    throw infrastructureError();
  }
}
