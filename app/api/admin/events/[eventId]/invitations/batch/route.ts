import { createRsvpInvitationBatch } from "@/lib/events/rsvp-invitation-service";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";

type Context = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, context: Context) {
  return executeRoute(async () => {
    const { eventId } = await context.params;
    const result = await createRsvpInvitationBatch(eventId, await parseJsonBody(request));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  });
}
