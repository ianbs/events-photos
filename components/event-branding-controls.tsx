"use client";

import type { ChangeEvent } from "react";

import type { BrandingAssetType } from "@/lib/events/event-branding-policy";

type EventBrandingControlsProps = {
  accentColor: string;
  acceptedTypes: string;
  coverImageUrl: string | null;
  disabled: boolean;
  logoImageUrl: string | null;
  onAccentColorChange: (color: string) => void;
  onPrimaryColorChange: (color: string) => void;
  onRemove: (assetType: BrandingAssetType) => void;
  onSelect: (assetType: BrandingAssetType, file: File | null) => void;
  primaryColor: string;
};

type BrandingFileFieldProps = {
  acceptedTypes: string;
  assetType: BrandingAssetType;
  disabled: boolean;
  hasImage: boolean;
  label: string;
  onRemove: (assetType: BrandingAssetType) => void;
  onSelect: (assetType: BrandingAssetType, file: File | null) => void;
  removeLabel: string;
};

function BrandingFileField({
  acceptedTypes,
  assetType,
  disabled,
  hasImage,
  label,
  onRemove,
  onSelect,
  removeLabel,
}: BrandingFileFieldProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onSelect(assetType, event.currentTarget.files?.[0] ?? null);
    event.currentTarget.value = "";
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
        <input
          type="file"
          accept={acceptedTypes}
          disabled={disabled}
          onChange={handleChange}
          className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2"
        />
      </label>
      {hasImage ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRemove(assetType)}
          className="mt-2 text-xs text-red-700 underline disabled:opacity-50"
        >
          {removeLabel}
        </button>
      ) : null}
    </div>
  );
}

export function EventBrandingControls({
  accentColor,
  acceptedTypes,
  coverImageUrl,
  disabled,
  logoImageUrl,
  onAccentColorChange,
  onPrimaryColorChange,
  onRemove,
  onSelect,
  primaryColor,
}: EventBrandingControlsProps) {
  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-2">
      <BrandingFileField
        acceptedTypes={acceptedTypes}
        assetType="cover"
        disabled={disabled}
        hasImage={Boolean(coverImageUrl)}
        label="Imagem de capa"
        onRemove={onRemove}
        onSelect={onSelect}
        removeLabel="Remover capa"
      />
      <BrandingFileField
        acceptedTypes={acceptedTypes}
        assetType="logo"
        disabled={disabled}
        hasImage={Boolean(logoImageUrl)}
        label="Logotipo"
        onRemove={onRemove}
        onSelect={onSelect}
        removeLabel="Remover logotipo"
      />
      <label className="text-sm font-medium text-slate-700">
        Cor principal
        <input
          type="color"
          value={primaryColor}
          disabled={disabled}
          onChange={(event) => onPrimaryColorChange(event.target.value)}
          className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white p-1"
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Cor de destaque
        <input
          type="color"
          value={accentColor}
          disabled={disabled}
          onChange={(event) => onAccentColorChange(event.target.value)}
          className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white p-1"
        />
      </label>
    </div>
  );
}
