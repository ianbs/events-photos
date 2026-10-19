import "server-only";

import { ApplicationError, validationError } from "@/lib/errors/application-error";
import { getServerEnvironment } from "@/lib/config/server-environment";

export function getPasswordRecoveryUrl() {
  return new URL("/admin/reset-password", getServerEnvironment().NEXT_PUBLIC_APP_URL).toString();
}

export function throwPasswordEmailError(error: { code?: string; status?: number }): never {
  if (error.code === "email_address_not_authorized") {
    throw new ApplicationError("INFRASTRUCTURE_ERROR", 503,
      "Configure um provedor SMTP no Supabase para enviar links a este e-mail.");
  }
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    throw validationError("O limite de envio de e-mails foi atingido. Aguarde antes de tentar novamente.");
  }
  throw new ApplicationError("INFRASTRUCTURE_ERROR", 503,
    "Não foi possível enviar o e-mail. Confira a configuração de envio no Supabase e tente novamente.");
}
