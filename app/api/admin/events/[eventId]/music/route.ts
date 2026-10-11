import { revalidatePath } from "next/cache";

import { saveEventMusic } from "@/lib/events/event-music-service";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";

type RouteContext = { params: Promise<{ eventId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { eventId } = await context.params;
    const { slug } = await saveEventMusic(eventId, await parseJsonBody(request));
    revalidatePath(`/admin/events/${eventId}/edit`);
    revalidatePath(`/e/${slug}`);
    revalidatePath(`/e/${slug}/save-the-date`);
    return new Response(null, { status: 204 });
  });
}
