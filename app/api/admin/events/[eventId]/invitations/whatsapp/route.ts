import { prepareWhatsAppInvitations } from "@/lib/events/rsvp-invitation-service";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  return executeRoute(async () => {
    const { eventId } = await context.params;
    const invitations = await prepareWhatsAppInvitations(eventId, await parseJsonBody(request));
    return Response.json({ invitations }, { headers: { "Cache-Control": "no-store" } });
  });
}
