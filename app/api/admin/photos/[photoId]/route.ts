import { executeRoute } from "@/lib/http/execute-route";
import {
  createAdminPhotoUrl,
  deletePhotoAsAdmin,
} from "@/lib/photos/admin-photo-service";

type RouteContext = {
  params: Promise<{ photoId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { photoId } = await context.params;
    const download = new URL(request.url).searchParams.get("download") === "1";
    const signedUrl = await createAdminPhotoUrl(photoId, download);
    return Response.redirect(signedUrl, 307);
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { photoId } = await context.params;
    await deletePhotoAsAdmin(photoId);
    return new Response(null, { status: 204 });
  });
}
