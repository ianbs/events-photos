import { validationError } from "@/lib/errors/application-error";
import {
  brandingUploadInputSchema,
  cleanupBrandingUploadSchema,
} from "@/lib/events/event-branding-contract";
import {
  cleanupEventBrandingUpload,
  initializeEventBrandingUpload,
} from "@/lib/events/event-branding-service";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { eventId } = await context.params;
    const input = brandingUploadInputSchema.safeParse(
      await parseJsonBody(request),
    );

    if (!input.success) {
      throw validationError("Dados do upload de identidade inválidos.");
    }

    const upload = await initializeEventBrandingUpload(eventId, input.data);
    return Response.json(upload, { status: 201 });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { eventId } = await context.params;
    const input = cleanupBrandingUploadSchema.safeParse(
      await parseJsonBody(request),
    );

    if (!input.success) {
      throw validationError("Dados de limpeza inválidos.");
    }

    await cleanupEventBrandingUpload(eventId, input.data);
    return new Response(null, { status: 204 });
  });
}
