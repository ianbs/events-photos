import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getServerEnvironment } from "@/lib/config/server-environment";
import { infrastructureError } from "@/lib/errors/application-error";
import { PHOTO_BUCKET } from "@/lib/photos/upload-policy";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const STORAGE_PROVIDERS = ["supabase", "s3"] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

export type DirectUpload =
  | {
      path: string;
      provider: "supabase";
      token: string;
    }
  | {
      path: string;
      provider: "s3";
      uploadUrl: string;
    };

type ObjectMetadata = {
  contentType: string;
  size: number;
};

type PhotoStorage = {
  createReadUrl(
    path: string,
    expiresInSeconds: number,
    downloadFilename?: string,
  ): Promise<string>;
  createReadUrls(
    paths: string[],
    expiresInSeconds: number,
  ): Promise<Map<string, string>>;
  createUpload(
    path: string,
    mimeType: string,
    fileSize: number,
  ): Promise<DirectUpload>;
  getMetadata(path: string): Promise<ObjectMetadata | null>;
  remove(path: string): Promise<void>;
};

const SIGNED_URL_BATCH_SIZE = 100;

function createSupabasePhotoStorage(): PhotoStorage {
  return {
    async createUpload(path) {
      const supabase = createAdminSupabaseClient();
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUploadUrl(path, { upsert: false });

      if (error || !data) {
        throw infrastructureError();
      }

      return { path, provider: "supabase", token: data.token };
    },

    async getMetadata(path) {
      const supabase = createAdminSupabaseClient();
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .info(path);

      if (error || !data) {
        return null;
      }

      return {
        contentType: data.contentType ?? "",
        size: data.size ?? 0,
      };
    },

    async createReadUrl(path, expiresInSeconds, downloadFilename) {
      const supabase = createAdminSupabaseClient();
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path, expiresInSeconds, {
          download: downloadFilename ?? false,
        });

      if (error || !data) {
        throw infrastructureError();
      }

      return data.signedUrl;
    },

    async createReadUrls(paths, expiresInSeconds) {
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
    },

    async remove(path) {
      const supabase = createAdminSupabaseClient();
      const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);

      if (error) {
        throw infrastructureError();
      }
    },
  };
}

function createS3PhotoStorage(): PhotoStorage {
  const environment = getServerEnvironment();
  const {
    S3_ACCESS_KEY_ID: accessKeyId,
    S3_BUCKET: bucket,
    S3_ENDPOINT: endpoint,
    S3_REGION: region,
    S3_SECRET_ACCESS_KEY: secretAccessKey,
  } = environment;

  if (!accessKeyId || !bucket || !endpoint || !secretAccessKey) {
    throw new Error("S3 storage is not configured");
  }

  const client = new S3Client({
    credentials: { accessKeyId, secretAccessKey },
    endpoint,
    forcePathStyle: environment.S3_FORCE_PATH_STYLE,
    region,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });

  return {
    async createUpload(path, mimeType, fileSize) {
      try {
        const uploadUrl = await getSignedUrl(
          client,
          new PutObjectCommand({
            Bucket: bucket,
            ContentLength: fileSize,
            ContentType: mimeType,
            Key: path,
          }),
          { expiresIn: 10 * 60 },
        );

        return { path, provider: "s3", uploadUrl };
      } catch {
        throw infrastructureError();
      }
    },

    async getMetadata(path) {
      try {
        const data = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: path }),
        );

        return {
          contentType: data.ContentType ?? "",
          size: data.ContentLength ?? 0,
        };
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "$metadata" in error &&
          (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404
        ) {
          return null;
        }

        throw infrastructureError();
      }
    },

    async createReadUrl(path, expiresInSeconds, downloadFilename) {
      try {
        return await getSignedUrl(
          client,
          new GetObjectCommand({
            Bucket: bucket,
            Key: path,
            ...(downloadFilename
              ? {
                  ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`,
                }
              : {}),
          }),
          { expiresIn: expiresInSeconds },
        );
      } catch {
        throw infrastructureError();
      }
    },

    async createReadUrls(paths, expiresInSeconds) {
      const entries = await Promise.all(
        paths.map(async (path) => {
          try {
            const signedUrl = await getSignedUrl(
              client,
              new GetObjectCommand({ Bucket: bucket, Key: path }),
              { expiresIn: expiresInSeconds },
            );
            return [path, signedUrl] as const;
          } catch {
            throw infrastructureError();
          }
        }),
      );

      return new Map(entries);
    },

    async remove(path) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }));
      } catch {
        throw infrastructureError();
      }
    },
  };
}

export function getConfiguredStorageProvider(): StorageProvider {
  return getServerEnvironment().STORAGE_PROVIDER;
}

export function parseStorageProvider(value: string): StorageProvider {
  if (value === "supabase" || value === "s3") {
    return value;
  }

  throw infrastructureError();
}

export function getPhotoStorage(provider: StorageProvider): PhotoStorage {
  return provider === "s3"
    ? createS3PhotoStorage()
    : createSupabasePhotoStorage();
}

export async function readPhotoObjectHeader(
  provider: StorageProvider,
  path: string,
): Promise<Uint8Array> {
  const signedUrl = await getPhotoStorage(provider).createReadUrl(path, 60);

  try {
    const response = await fetch(signedUrl, {
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
