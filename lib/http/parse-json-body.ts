import { validationError } from "@/lib/errors/application-error";

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw validationError("O corpo da requisição deve conter JSON válido.");
  }
}
