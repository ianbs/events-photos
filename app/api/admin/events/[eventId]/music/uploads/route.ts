import { cleanupEventMusicUpload, initializeEventMusicUpload } from "@/lib/events/event-music-service";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";

type RouteContext = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { eventId } = await context.params;
    const upload = await initializeEventMusicUpload(eventId, await parseJsonBody(request));
    return Response.json(upload, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { eventId } = await context.params;
    await cleanupEventMusicUpload(eventId, await parseJsonBody(request));
    return new Response(null, { status: 204 });
  });
}
