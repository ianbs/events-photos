"use client";

import Image from "next/image";

type EventBrandingPreviewProps = {
  accentColor: string;
  coverImageUrl: string | null;
  eventName: string;
  logoImageUrl: string | null;
  primaryColor: string;
};

export function EventBrandingPreview({
  accentColor,
  coverImageUrl,
  eventName,
  logoImageUrl,
  primaryColor,
}: EventBrandingPreviewProps) {
  return (
    <div
      className="mt-6 overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200"
      style={{ borderColor: accentColor }}
    >
      <div className="relative flex min-h-40 items-center justify-center bg-slate-200">
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt="Prévia da capa"
            fill
            unoptimized={coverImageUrl.startsWith("blob:")}
            className="object-cover"
          />
        ) : (
          <span className="text-sm text-slate-500">Sem imagem de capa</span>
        )}
        <div className="absolute inset-0 bg-black/25" />
        {logoImageUrl ? (
          <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-white shadow-lg">
            <Image
              src={logoImageUrl}
              alt="Prévia do logotipo"
              fill
              unoptimized={logoImageUrl.startsWith("blob:")}
              className="object-contain p-2"
            />
          </div>
        ) : null}
      </div>
      <div className="p-5 text-center">
        <p className="text-xl font-semibold" style={{ color: primaryColor }}>
          {eventName}
        </p>
        <span
          className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Enviar foto
        </span>
      </div>
    </div>
  );
}
