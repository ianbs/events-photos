import "server-only";

import { infrastructureError } from "@/lib/errors/application-error";
import { PHOTO_BUCKET } from "@/lib/photos/upload-policy";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const SIGNED_URL_BATCH_SIZE = 100;

export async function createSignedPhotoUrls(
  paths: string[],
  expiresInSeconds: number,
): Promise<Map<string, string>> {
  const supabase = createAdminSupabaseClient();
  const urlsByPath = new Map<string, string>();

  for (let index = 0; index < paths.length; index += SIGNED_URL_BATCH_SIZE) {
    const batch = paths.slice(index, index + SIGNED_URL_BATCH_SIZE);
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(batch, expiresInSeconds);

    if (error || !data) {
      throw infrastructureError();
    }

    for (const item of data) {
      if (!item.path || !item.signedUrl) {
        throw infrastructureError();
      }

      urlsByPath.set(item.path, item.signedUrl);
    }
  }

  return urlsByPath;
}
