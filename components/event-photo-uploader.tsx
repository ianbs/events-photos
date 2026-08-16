"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  createGuestToken,
  getGuestTokenStorageKey,
  guestTokenSchema,
} from "@/lib/guests/guest-token";
import {
  apiErrorResponseSchema,
  uploadCompletionResponseSchema,
  uploadInitializationResponseSchema,
} from "@/lib/photos/upload-contract";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_SIZE_MB,
  validateImageUpload,
} from "@/lib/photos/upload-policy";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { GuestPhotoGallery } from "@/components/guest-photo-gallery";

type EventPhotoUploaderProps = {
  eventId: string;
  eventSlug: string;
};

type GuestStatus = "loading" | "ready" | "error";
type UploadStatus = "idle" | "uploading" | "success" | "error";

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getApiErrorMessage(body: unknown, fallback: string): string {
  const result = apiErrorResponseSchema.safeParse(body);
  return result.success ? result.data.error.message : fallback;
}

export function EventPhotoUploader({
  eventId,
  eventSlug,
}: EventPhotoUploaderProps) {
  const cameraInputId = useId();
  const galleryInputId = useId();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [guestStatus, setGuestStatus] = useState<GuestStatus>("loading");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [galleryRevision, setGalleryRevision] = useState(0);
  const [message, setMessage] = useState("Preparando seu acesso seguro...");

  useEffect(() => {
    const controller = new AbortController();

    async function initializeGuest() {
      try {
        const storageKey = getGuestTokenStorageKey(eventId);
        const storedToken = localStorage.getItem(storageKey);
        const storedTokenResult = guestTokenSchema.safeParse(storedToken);
        const token = storedTokenResult.success
          ? storedTokenResult.data
          : createGuestToken();
        const response = await fetch(`/api/events/${eventSlug}/guests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guestToken: token }),
          signal: controller.signal,
        });
        const responseBody = await readResponseBody(response);

        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(
              responseBody,
              "Não foi possível preparar seu acesso.",
            ),
          );
        }

        localStorage.setItem(storageKey, token);
        setGuestToken(token);
        setGuestStatus("ready");
        setMessage("Escolha uma foto para começar.");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setGuestStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível preparar seu acesso.",
        );
      }
    }

    void initializeGuest();
    return () => controller.abort();
  }, [eventId, eventSlug]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    },
    [],
  );

  function replaceSelectedFile(file: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const nextPreviewUrl = file ? URL.createObjectURL(file) : null;
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setSelectedFile(file);
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    const validation = validateImageUpload(file);

    if (!validation.valid) {
      replaceSelectedFile(null);
      setUploadStatus("error");
      setMessage(validation.message);
      return;
    }

    replaceSelectedFile(file);
    setUploadStatus("idle");
    setMessage("Confira a imagem antes de enviar.");
  }

  async function requestCleanup(
    photoId: string,
    token: string,
    mimeType: string,
  ) {
    try {
      await fetch(`/api/events/${eventSlug}/uploads/${photoId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestToken: token, mimeType }),
      });
    } catch {
      // A server-side cleanup also runs for validation and persistence failures.
    }
  }

  async function uploadSelectedPhoto() {
    if (!selectedFile || !guestToken || guestStatus !== "ready") {
      return;
    }

    const validation = validateImageUpload(selectedFile);

    if (!validation.valid) {
      setUploadStatus("error");
      setMessage(validation.message);
      return;
    }

    setUploadStatus("uploading");
    setMessage("Enviando sua foto...");

    const uploadInput = {
      guestToken,
      originalFilename: selectedFile.name,
      mimeType: validation.mimeType,
      fileSize: selectedFile.size,
    };

    try {
      const initializationResponse = await fetch(
        `/api/events/${eventSlug}/uploads`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(uploadInput),
        },
      );
      const initializationBody = await readResponseBody(initializationResponse);

      if (!initializationResponse.ok) {
        throw new Error(
          getApiErrorMessage(
            initializationBody,
            "Não foi possível iniciar o upload.",
          ),
        );
      }

      const initialization = uploadInitializationResponseSchema.parse(
        initializationBody,
      );
      const supabase = createBrowserSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .uploadToSignedUrl(
          initialization.path,
          initialization.token,
          selectedFile,
          {
            cacheControl: "3600",
            contentType: validation.mimeType,
            upsert: false,
          },
        );

      if (uploadError) {
        await requestCleanup(
          initialization.photoId,
          guestToken,
          validation.mimeType,
        );
        throw new Error("Falha ao enviar a imagem. Tente novamente.");
      }

      setMessage("Confirmando o envio...");
      const completionResponse = await fetch(
        `/api/events/${eventSlug}/uploads/${initialization.photoId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(uploadInput),
        },
      );
      const completionBody = await readResponseBody(completionResponse);

      if (!completionResponse.ok) {
        throw new Error(
          getApiErrorMessage(
            completionBody,
            "A foto foi enviada, mas não pôde ser confirmada.",
          ),
        );
      }

      uploadCompletionResponseSchema.parse(completionBody);
      replaceSelectedFile(null);
      setUploadStatus("success");
      setMessage("Foto enviada com sucesso!");
      setGalleryRevision((revision) => revision + 1);
    } catch (error) {
      setUploadStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a foto.",
      );
    }
  }

  const controlsDisabled = guestStatus !== "ready" || uploadStatus === "uploading";
  const acceptedTypes = ALLOWED_IMAGE_MIME_TYPES.join(",");

  return (
    <>
      <section className="mt-8 w-full rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={cameraInputRef}
          id={cameraInputId}
          className="sr-only"
          type="file"
          accept={acceptedTypes}
          capture="environment"
          disabled={controlsDisabled}
          onChange={handleFileSelection}
        />
        <label
          htmlFor={cameraInputId}
          aria-disabled={controlsDisabled}
          className="flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl bg-[var(--event-primary)] px-5 py-3 font-medium text-white aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          Tirar foto
        </label>

        <input
          ref={galleryInputRef}
          id={galleryInputId}
          className="sr-only"
          type="file"
          accept={acceptedTypes}
          disabled={controlsDisabled}
          onChange={handleFileSelection}
        />
        <label
          htmlFor={galleryInputId}
          aria-disabled={controlsDisabled}
          className="flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-900 aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          Escolher foto
        </label>
      </div>

      <p className="mt-3 text-center text-sm text-slate-500">
        JPEG, PNG, WebP, HEIC ou HEIF, até {MAX_UPLOAD_SIZE_MB} MB.
      </p>

      {previewUrl ? (
        <div className="mt-5 overflow-hidden rounded-2xl bg-slate-100">
          <div className="relative aspect-[4/3]">
            <Image
              src={previewUrl}
              alt="Prévia da foto selecionada"
              fill
              unoptimized
              className="object-contain"
            />
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row">
            <button
              type="button"
              className="min-h-12 flex-1 rounded-xl border border-slate-300 px-4 py-3 font-medium disabled:opacity-50"
              disabled={uploadStatus === "uploading"}
              onClick={() => replaceSelectedFile(null)}
            >
              Remover
            </button>
            <button
              type="button"
              className="min-h-12 flex-1 rounded-xl bg-[var(--event-primary)] px-4 py-3 font-semibold text-white disabled:opacity-50"
              disabled={controlsDisabled}
              onClick={() => void uploadSelectedPhoto()}
            >
              {uploadStatus === "uploading" ? "Enviando..." : "Enviar foto"}
            </button>
          </div>
        </div>
      ) : null}

      <p
        role="status"
        aria-live="polite"
        className={`mt-5 rounded-xl px-4 py-3 text-center text-sm ${
          uploadStatus === "error" || guestStatus === "error"
            ? "bg-red-50 text-red-700"
            : uploadStatus === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-50 text-slate-600"
        }`}
      >
        {message}
      </p>
      </section>
      <GuestPhotoGallery
        eventSlug={eventSlug}
        guestToken={guestToken}
        refreshKey={galleryRevision}
      />
    </>
  );
}
