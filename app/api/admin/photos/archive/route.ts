import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";
import { createSelectedPhotoArchive } from "@/lib/photos/admin-photo-archive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return executeRoute(async () => {
    const body = await parseJsonBody(request);
    const photoIds =
      typeof body === "object" && body !== null && "photoIds" in body
        ? body.photoIds
        : null;
    const archive = await createSelectedPhotoArchive(photoIds);

    return new Response(archive.stream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${archive.fileName}"`,
        "Content-Type": "application/zip",
      },
    });
  });
}
