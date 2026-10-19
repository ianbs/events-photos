import { revalidatePath } from "next/cache";
import { deleteAdminEventBatch } from "@/lib/events/admin-event-deletion-service";
import { validationError } from "@/lib/errors/application-error";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";

export async function DELETE(request: Request, context: { params: Promise<{ eventId: string }> }) {
  return executeRoute(async () => {
    // This destructive endpoint accepts only requests from the application origin.
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      throw validationError("Origem da solicitação inválida. Atualize a página e tente novamente.");
    }
    const { eventId } = await context.params;
    const result = await deleteAdminEventBatch(eventId, await parseJsonBody(request));
    revalidatePath("/admin");
    if (result.slug) {
      revalidatePath(`/e/${result.slug}`);
      revalidatePath(`/e/${result.slug}/save-the-date`);
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  });
}
