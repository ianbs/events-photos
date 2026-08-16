import { guestGalleryRequestSchema } from "@/lib/photos/photo-gallery-contract";
import { listGuestPhotos } from "@/lib/photos/photo-gallery-service";
import { validationError } from "@/lib/errors/application-error";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { slug } = await context.params;
    const input = guestGalleryRequestSchema.safeParse(await parseJsonBody(request));

    if (!input.success) {
      throw validationError("Token do convidado inválido.");
    }

    const photos = await listGuestPhotos(slug, input.data.guestToken);
    return Response.json(
      { photos },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}
