import { validationError } from "@/lib/errors/application-error";
import { finalizeEventBrandingSchema } from "@/lib/events/event-branding-contract";
import { finalizeEventBranding } from "@/lib/events/event-branding-service";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { eventId } = await context.params;
    const input = finalizeEventBrandingSchema.safeParse(
      await parseJsonBody(request),
    );

    if (!input.success) {
      throw validationError("Dados da identidade visual inválidos.");
    }

    await finalizeEventBranding(eventId, input.data);
    return new Response(null, { status: 204 });
  });
}
