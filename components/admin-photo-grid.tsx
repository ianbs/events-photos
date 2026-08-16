"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AdminPhoto } from "@/lib/photos/admin-photo-service";

type AdminPhotoGridProps = {
  photos: AdminPhoto[];
};

function formatBytes(value: number): string {
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function AdminPhotoGrid({ photos }: AdminPhotoGridProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deletePhoto(photo: AdminPhoto) {
    if (!window.confirm(`Excluir permanentemente “${photo.originalFilename}”?`)) {
      return;
    }

    setDeletingId(photo.id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/photos/${photo.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Não foi possível excluir a foto.");
      }

      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível excluir a foto.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (photos.length === 0) {
    return (
      <p className="rounded-2xl bg-white px-5 py-10 text-center text-slate-600 shadow-sm ring-1 ring-slate-200">
        Nenhuma foto foi enviada ainda.
      </p>
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-red-700">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => (
          <article
            key={photo.id}
            className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
          >
            <a
              href={`/api/admin/photos/${photo.id}`}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <div className="relative aspect-[4/3] bg-slate-100">
                <Image
                  src={photo.signedUrl}
                  alt={photo.originalFilename}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
            </a>
            <div className="p-4">
              <p className="truncate font-medium">{photo.originalFilename}</p>
              <p className="mt-1 text-sm text-slate-500">
                {photo.eventName} · {formatBytes(photo.fileSize)}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <a
                  href={`/api/admin/photos/${photo.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-300 px-2 py-2"
                >
                  Abrir
                </a>
                <a
                  href={`/api/admin/photos/${photo.id}?download=1`}
                  className="rounded-lg border border-slate-300 px-2 py-2"
                >
                  Baixar
                </a>
                <button
                  type="button"
                  disabled={deletingId === photo.id}
                  onClick={() => void deletePhoto(photo)}
                  className="rounded-lg bg-red-600 px-2 py-2 text-white disabled:opacity-50"
                >
                  {deletingId === photo.id ? "..." : "Excluir"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
