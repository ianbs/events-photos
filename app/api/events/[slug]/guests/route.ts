import { z } from "zod";

import { validationError } from "@/lib/errors/application-error";
import { guestTokenSchema } from "@/lib/guests/guest-token";
import { createOrRecoverGuest } from "@/lib/guests/guest-service";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";

const requestSchema = z.object({
  guestToken: guestTokenSchema,
});

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { slug } = await context.params;
    const result = requestSchema.safeParse(await parseJsonBody(request));

    if (!result.success) {
      throw validationError("Token do convidado inválido.");
    }

    await createOrRecoverGuest(slug, result.data.guestToken);

    return Response.json({ ready: true });
  });
}
