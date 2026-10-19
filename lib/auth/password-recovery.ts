import { z } from "zod";

export const newPasswordSchema = z.object({
  password: z.string().min(12, "Use pelo menos 12 caracteres.").max(128, "Use no máximo 128 caracteres."),
  confirmation: z.string(),
}).refine((value) => value.password === value.confirmation, {
  path: ["confirmation"], message: "As senhas não coincidem.",
});

export type RecoveryCredentials =
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "token"; tokenHash: string; type: "recovery" | "invite" }
  | { kind: "invalid" }
  | { kind: "none" };

export function readRecoveryCredentials(url: URL): RecoveryCredentials {
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (fragment.has("error") || url.searchParams.has("error")) return { kind: "invalid" };
  const type = fragment.get("type") ?? url.searchParams.get("type");
  const tokenHash = url.searchParams.get("token_hash");
  if (tokenHash && (type === "recovery" || type === "invite")) {
    return { kind: "token", tokenHash, type };
  }
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (accessToken && refreshToken && (type === "recovery" || type === "invite")) {
    return { kind: "session", accessToken, refreshToken };
  }
  if (url.hash || tokenHash || url.searchParams.has("code")) return { kind: "invalid" };
  return { kind: "none" };
}
