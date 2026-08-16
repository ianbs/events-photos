export type ApplicationErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INFRASTRUCTURE_ERROR";

export class ApplicationError extends Error {
  constructor(
    readonly code: ApplicationErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export function validationError(message: string) {
  return new ApplicationError("VALIDATION_ERROR", 400, message);
}

export function unauthorizedError(message = "Autenticação necessária.") {
  return new ApplicationError("UNAUTHORIZED", 401, message);
}

export function notFoundError(message: string) {
  return new ApplicationError("NOT_FOUND", 404, message);
}

export function forbiddenError(message: string) {
  return new ApplicationError("FORBIDDEN", 403, message);
}

export function infrastructureError() {
  return new ApplicationError(
    "INFRASTRUCTURE_ERROR",
    503,
    "Serviço temporariamente indisponível. Tente novamente.",
  );
}
