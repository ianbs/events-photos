import "server-only";

import {
  getPhotoStorage,
  type StorageProvider,
} from "@/lib/storage/photo-storage";

export type StoredPhotoLocation = {
  storagePath: string;
  storageProvider: StorageProvider;
};

export async function createSignedPhotoUrls(
  locations: StoredPhotoLocation[],
  expiresInSeconds: number,
): Promise<Map<string, string>> {
  const urlsByPath = new Map<string, string>();
  const pathsByProvider = new Map<StorageProvider, string[]>();

  for (const location of locations) {
    const paths = pathsByProvider.get(location.storageProvider) ?? [];
    paths.push(location.storagePath);
    pathsByProvider.set(location.storageProvider, paths);
  }

  for (const [provider, paths] of pathsByProvider) {
    const providerUrls = await getPhotoStorage(provider).createReadUrls(
      paths,
      expiresInSeconds,
    );
    for (const [path, url] of providerUrls) {
      urlsByPath.set(path, url);
    }
  }

  return urlsByPath;
}
