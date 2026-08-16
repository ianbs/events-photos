import "server-only";

import QRCode from "qrcode";

import { getServerEnvironment } from "@/lib/config/server-environment";

export async function createEventQrCode(slug: string): Promise<{
  eventUrl: string;
  qrCodeDataUrl: string;
}> {
  const appUrl = getServerEnvironment().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const eventUrl = `${appUrl}/e/${slug}`;
  const qrCodeDataUrl = await QRCode.toDataURL(eventUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 640,
  });

  return { eventUrl, qrCodeDataUrl };
}
