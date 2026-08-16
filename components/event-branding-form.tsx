"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EventBrandingPreview } from "@/components/event-branding-preview";
import { EventBrandingControls } from "@/components/event-branding-controls";
import type { UploadedBrandingAsset } from "@/lib/events/event-branding-contract";
import {
  cleanupBrandingUploads,
  saveEventBranding,
  uploadBrandingAsset,
} from "@/lib/events/event-branding-browser-service";
import {
  BRANDING_IMAGE_MIME_TYPES,
  MAX_BRANDING_IMAGE_SIZE_MB,
  validateBrandingImage,
  type BrandingAssetType,
} from "@/lib/events/event-branding-policy";

type EventBrandingFormProps = {
  eventId: string;
  eventName: string;
  initialAccentColor: string;
  initialCoverImageUrl: string | null;
  initialLogoImageUrl: string | null;
  initialPrimaryColor: string;
};

type SelectedAssets = Record<BrandingAssetType, File | null>;
type PreviewUrls = Record<BrandingAssetType, string | null>;

const emptyAssets: SelectedAssets = { cover: null, logo: null };
const emptyPreviews: PreviewUrls = { cover: null, logo: null };

export function EventBrandingForm({
  eventId,
  eventName,
  initialAccentColor,
  initialCoverImageUrl,
  initialLogoImageUrl,
  initialPrimaryColor,
}: EventBrandingFormProps) {
  const router = useRouter();
  const previewUrlsRef = useRef<PreviewUrls>(emptyPreviews);
  const [accentColor, setAccentColor] = useState(initialAccentColor);
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor);
  const [selectedAssets, setSelectedAssets] =
    useState<SelectedAssets>(emptyAssets);
  const [previewUrls, setPreviewUrls] = useState<PreviewUrls>(emptyPreviews);
  const [removeCover, setRemoveCover] = useState(false);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(
    () => () => {
      for (const url of Object.values(previewUrlsRef.current)) {
        if (url) {
          URL.revokeObjectURL(url);
        }
      }
    },
    [],
  );

  function selectAsset(assetType: BrandingAssetType, file: File | null) {
    if (!file) {
      return;
    }

    const validation = validateBrandingImage(file);

    if (!validation.valid) {
      setStatus("error");
      setMessage(validation.message);
      return;
    }

    const currentPreview = previewUrlsRef.current[assetType];

    if (currentPreview) {
      URL.revokeObjectURL(currentPreview);
    }

    const nextPreview = URL.createObjectURL(file);
    const nextPreviews = { ...previewUrlsRef.current, [assetType]: nextPreview };
    previewUrlsRef.current = nextPreviews;
    setPreviewUrls(nextPreviews);
    setSelectedAssets((current) => ({ ...current, [assetType]: file }));

    if (assetType === "cover") {
      setRemoveCover(false);
    } else {
      setRemoveLogo(false);
    }

    setStatus("idle");
    setMessage(null);
  }

  function removeAsset(assetType: BrandingAssetType) {
    const currentPreview = previewUrlsRef.current[assetType];

    if (currentPreview) {
      URL.revokeObjectURL(currentPreview);
    }

    const nextPreviews = { ...previewUrlsRef.current, [assetType]: null };
    previewUrlsRef.current = nextPreviews;
    setPreviewUrls(nextPreviews);
    setSelectedAssets((current) => ({ ...current, [assetType]: null }));

    if (assetType === "cover") {
      setRemoveCover(true);
    } else {
      setRemoveLogo(true);
    }
  }

  async function saveBranding() {
    setStatus("saving");
    setMessage("Salvando identidade visual...");
    const uploadedAssets: UploadedBrandingAsset[] = [];
    let finalizationStarted = false;

    try {
      for (const assetType of ["cover", "logo"] as const) {
        const file = selectedAssets[assetType];

        if (file) {
          uploadedAssets.push(
            await uploadBrandingAsset(eventId, assetType, file),
          );
        }
      }

      finalizationStarted = true;
      await saveEventBranding(eventId, {
        accentColor,
        primaryColor,
        removeCover,
        removeLogo,
        uploadedAssets,
      });

      for (const url of Object.values(previewUrlsRef.current)) {
        if (url) {
          URL.revokeObjectURL(url);
        }
      }

      previewUrlsRef.current = emptyPreviews;
      setPreviewUrls(emptyPreviews);
      setSelectedAssets(emptyAssets);
      setRemoveCover(false);
      setRemoveLogo(false);
      setStatus("success");
      setMessage("Identidade visual atualizada com sucesso.");
      router.refresh();
    } catch (error) {
      if (!finalizationStarted) {
        await cleanupBrandingUploads(eventId, uploadedAssets);
      }

      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a identidade visual.",
      );
    }
  }

  const coverImageUrl = previewUrls.cover ??
    (removeCover ? null : initialCoverImageUrl);
  const logoImageUrl = previewUrls.logo ??
    (removeLogo ? null : initialLogoImageUrl);
  const acceptedTypes = BRANDING_IMAGE_MIME_TYPES.join(",");

  return (
    <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">
        Identidade visual
      </p>
      <h2 className="mt-1 text-2xl font-semibold">Aparência do evento</h2>
      <p className="mt-2 text-sm text-slate-600">
        Personalize a página dos convidados. Imagens JPEG, PNG ou WebP de até{" "}
        {MAX_BRANDING_IMAGE_SIZE_MB} MB.
      </p>

      <EventBrandingPreview
        accentColor={accentColor}
        coverImageUrl={coverImageUrl}
        eventName={eventName}
        logoImageUrl={logoImageUrl}
        primaryColor={primaryColor}
      />

      <EventBrandingControls
        accentColor={accentColor}
        acceptedTypes={acceptedTypes}
        coverImageUrl={coverImageUrl}
        disabled={status === "saving"}
        logoImageUrl={logoImageUrl}
        onAccentColorChange={setAccentColor}
        onPrimaryColorChange={setPrimaryColor}
        onRemove={removeAsset}
        onSelect={selectAsset}
        primaryColor={primaryColor}
      />

      {message ? (
        <p
          role="status"
          className={`mt-5 rounded-xl px-4 py-3 text-sm ${
            status === "error"
              ? "bg-red-50 text-red-700"
              : status === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-50 text-slate-600"
          }`}
        >
          {message}
        </p>
      ) : null}

      <button
        type="button"
        disabled={status === "saving"}
        onClick={() => void saveBranding()}
        className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:cursor-wait disabled:opacity-60"
      >
        {status === "saving" ? "Salvando..." : "Salvar identidade visual"}
      </button>
    </section>
  );
}
