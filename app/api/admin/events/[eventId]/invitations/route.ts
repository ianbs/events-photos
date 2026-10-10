import { createRsvpInvitation, changeRsvpInvitation, deleteRsvpGuest } from "@/lib/events/rsvp-invitation-service";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";

type Context = { params: Promise<{ eventId: string }> };

export async function DELETE(request: Request, context: Context) {
  return executeRoute(async () => {
    const { eventId } = await context.params;
    await deleteRsvpGuest(eventId, await parseJsonBody(request));
    return Response.json({ invitation: null }, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(request: Request, context: Context) {
  return executeRoute(async () => {
    const { eventId } = await context.params;
    const invitation = await createRsvpInvitation(eventId, await parseJsonBody(request));
    return Response.json({ invitation }, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function PATCH(request: Request, context: Context) {
  return executeRoute(async () => {
    const { eventId } = await context.params;
    const invitation = await changeRsvpInvitation(eventId, await parseJsonBody(request));
    return Response.json({ invitation }, { headers: { "Cache-Control": "no-store" } });
  });
}
