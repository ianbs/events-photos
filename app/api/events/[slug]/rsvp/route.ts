import { z } from "zod";

import { validationError } from "@/lib/errors/application-error";
import { readGuestRsvp, saveGuestRsvp } from "@/lib/events/rsvp-service";
import { guestTokenSchema } from "@/lib/guests/guest-token";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";

type Context = { params: Promise<{ slug: string }> };

// Tokens stay in the request body, never in URLs or access logs.
export async function POST(request: Request, context: Context) {
  return executeRoute(async () => {
    const { slug } = await context.params;
    const input = z.object({ guestToken: guestTokenSchema }).safeParse(await parseJsonBody(request));
    if (!input.success) throw validationError("Token do convidado inválido.");
    const rsvp = await readGuestRsvp(slug, input.data.guestToken);
    return Response.json({ rsvp }, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function PUT(request: Request, context: Context) {
  return executeRoute(async () => {
    const { slug } = await context.params;
    const rsvp = await saveGuestRsvp(slug, await parseJsonBody(request));
    return Response.json({ rsvp }, { headers: { "Cache-Control": "no-store" } });
  });
}
