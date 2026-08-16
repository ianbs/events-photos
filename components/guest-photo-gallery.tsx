"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import {
  guestGalleryResponseSchema,
  type PhotoGalleryItem,
} from "@/lib/photos/photo-gallery-contract";

type GuestPhotoGalleryProps = {
  eventSlug: string;
  guestToken: string | null;
  refreshKey: number;
};

function formatPhotoDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function GuestPhotoGallery({
  eventSlug,
  guestToken,
  refreshKey,
}: GuestPhotoGalleryProps) {
  const [photos, setPhotos] = useState<PhotoGalleryItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  useEffect(() => {
    if (!guestToken) {
      return;
    }

    const controller = new AbortController();

    async function loadPhotos() {
      setStatus("loading");

      try {
        const response = await fetch(`/api/events/${eventSlug}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guestToken }),
          cache: "no-store",
          signal: controller.signal,
        });
        const body: unknown = await response.json();

        if (!response.ok) {
          throw new Error("Não foi possível carregar suas fotos.");
        }

        const result = guestGalleryResponseSchema.parse(body);
        setPhotos(result.photos);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) {
          setStatus("error");
        }
      }
    }

    void loadPhotos();
    return () => controller.abort();
  }, [eventSlug, guestToken, refreshKey]);

  return (
    <section className="mt-6 w-full rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-[var(--event-primary)]">
            Galeria do convidado
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Minhas fotos</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
          {photos.length}
        </span>
      </div>

      {status === "loading" || status === "idle" ? (
        <p className="mt-5 text-sm text-slate-500">Carregando suas fotos...</p>
      ) : null}

      {status === "error" ? (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar suas fotos. Recarregue a página.
        </p>
      ) : null}

      {status === "ready" && photos.length === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-600">
          As fotos enviadas por este dispositivo aparecerão aqui.
        </p>
      ) : null}

      {photos.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <a
              key={photo.id}
              href={photo.signedUrl}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200"
            >
              <div className="relative aspect-square">
                <Image
                  src={photo.signedUrl}
                  alt={photo.originalFilename}
                  fill
                  sizes="(max-width: 640px) 50vw, 220px"
                  className="object-cover transition group-active:scale-[0.98]"
                />
              </div>
              <p className="truncate px-3 pt-2 text-xs font-medium text-slate-700">
                {photo.originalFilename}
              </p>
              <p className="px-3 pb-3 text-[11px] text-slate-500">
                {formatPhotoDate(photo.createdAt)}
              </p>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
