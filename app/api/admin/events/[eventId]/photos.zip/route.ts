import { createEventPhotoArchive } from "@/lib/photos/admin-photo-archive-service";
import { executeRoute } from "@/lib/http/execute-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { eventId } = await context.params;
    const archive = await createEventPhotoArchive(eventId);

    return new Response(archive.stream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${archive.fileName}"`,
        "Content-Type": "application/zip",
      },
    });
  });
}
