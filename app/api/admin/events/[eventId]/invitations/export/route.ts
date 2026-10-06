import { exportRsvpInvitations } from "@/lib/events/rsvp-invitation-service";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  return executeRoute(async () => {
    const { eventId } = await context.params;
    const csv = await exportRsvpInvitations(eventId, await parseJsonBody(request));
    return new Response(csv, { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="convites-whatsapp.csv"',
    } });
  });
}
