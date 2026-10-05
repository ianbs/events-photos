"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AdminPhoto } from "@/lib/photos/admin-photo-service";

type AdminPhotoGridProps = {
  photos: AdminPhoto[];
  totalCount: number;
};

function formatBytes(value: number): string {
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatPhotoDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminPhotoGrid({ photos, totalCount }: AdminPhotoGridProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingSelection, setDownloadingSelection] = useState(false);
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

      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(photo.id);
        return next;
      });
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

  function togglePhoto(photoId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }

  function toggleVisiblePhotos() {
    setSelectedIds((current) => {
      const allVisibleSelected = photos.every((photo) => current.has(photo.id));
      const next = new Set(current);

      for (const photo of photos) {
        if (allVisibleSelected) {
          next.delete(photo.id);
        } else {
          next.add(photo.id);
        }
      }

      return next;
    });
  }

  async function downloadSelectedPhotos() {
    if (selectedIds.size === 0) {
      return;
    }

    setDownloadingSelection(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/photos/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "object" &&
          body.error !== null &&
          "message" in body.error &&
          typeof body.error.message === "string"
            ? body.error.message
            : "Não foi possível preparar o ZIP.";
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "fotos-selecionadas.zip";
      link.click();
      URL.revokeObjectURL(url);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível preparar o ZIP.",
      );
    } finally {
      setDownloadingSelection(false);
    }
  }

  if (photos.length === 0) {
    return (
      <p className="rounded-2xl bg-white px-5 py-10 text-center text-slate-600 shadow-sm ring-1 ring-slate-200">
        Nenhuma foto corresponde aos filtros escolhidos.
      </p>
    );
  }

  const allVisibleSelected = photos.every((photo) => selectedIds.has(photo.id));

  return (
    <>
      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleVisiblePhotos}
            className="h-5 w-5 accent-emerald-700"
          />
          Selecionar as {photos.length} fotos desta página
        </label>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {selectedIds.size} selecionada(s) · {totalCount} resultado(s)
          </span>
          <button
            type="button"
            disabled={selectedIds.size === 0 || downloadingSelection}
            onClick={() => void downloadSelectedPhotos()}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloadingSelection ? "Preparando ZIP..." : "Baixar selecionadas"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => (
          <article
            key={photo.id}
            className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-2 ${
              selectedIds.has(photo.id) ? "ring-emerald-600" : "ring-transparent"
            }`}
          >
            <div className="relative">
              <a
                href={`/api/admin/photos/${photo.id}`}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">
                  <Image
                    src={photo.signedUrl}
                    alt={photo.originalFilename}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition duration-200 hover:scale-[1.02]"
                  />
                </div>
              </a>
              <label className="absolute left-3 top-3 flex cursor-pointer items-center rounded-lg bg-white/95 p-2 shadow-sm">
                <input
                  type="checkbox"
                  checked={selectedIds.has(photo.id)}
                  onChange={() => togglePhoto(photo.id)}
                  aria-label={`Selecionar ${photo.originalFilename}`}
                  className="h-5 w-5 accent-emerald-700"
                />
              </label>
            </div>
            <div className="p-4">
              <p className="truncate font-medium">{photo.originalFilename}</p>
              <p className="mt-1 truncate text-sm text-emerald-700">
                {photo.eventName}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatBytes(photo.fileSize)} · {formatPhotoDate(photo.createdAt)}
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
