import { validationError } from "@/lib/errors/application-error";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";
import {
  cleanupUploadRequestSchema,
  completeUploadRequestSchema,
} from "@/lib/photos/upload-contract";
import {
  cleanupPhotoUpload,
  completePhotoUpload,
} from "@/lib/photos/photo-upload-service";

type RouteContext = {
  params: Promise<{ slug: string; photoId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { slug, photoId } = await context.params;
    const result = completeUploadRequestSchema.safeParse(
      await parseJsonBody(request),
    );

    if (!result.success) {
      throw validationError("Dados de confirmação do upload inválidos.");
    }

    const photo = await completePhotoUpload(slug, photoId, result.data);

    return Response.json(photo);
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { slug, photoId } = await context.params;
    const result = cleanupUploadRequestSchema.safeParse(
      await parseJsonBody(request),
    );

    if (!result.success) {
      throw validationError("Dados de limpeza do upload inválidos.");
    }

    await cleanupPhotoUpload(
      slug,
      photoId,
      result.data.guestToken,
      result.data.mimeType,
    );

    return new Response(null, { status: 204 });
  });
}
