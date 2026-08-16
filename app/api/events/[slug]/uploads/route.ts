import { validationError } from "@/lib/errors/application-error";
import { executeRoute } from "@/lib/http/execute-route";
import { parseJsonBody } from "@/lib/http/parse-json-body";
import { initializeUploadRequestSchema } from "@/lib/photos/upload-contract";
import { initializePhotoUpload } from "@/lib/photos/photo-upload-service";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return executeRoute(async () => {
    const { slug } = await context.params;
    const result = initializeUploadRequestSchema.safeParse(
      await parseJsonBody(request),
    );

    if (!result.success) {
      throw validationError("Dados do upload inválidos.");
    }

    const upload = await initializePhotoUpload(slug, result.data);

    return Response.json(upload, { status: 201 });
  });
}
