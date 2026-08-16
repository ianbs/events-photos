import { ApplicationError } from "@/lib/errors/application-error";

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

export async function executeRoute(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApplicationError) {
      const body: ErrorResponse = {
        error: { code: error.code, message: error.message },
      };

      return Response.json(body, { status: error.status });
    }

    console.error("Unexpected route failure");

    const body: ErrorResponse = {
      error: {
        code: "UNEXPECTED_ERROR",
        message: "Ocorreu um erro inesperado. Tente novamente.",
      },
    };

    return Response.json(body, { status: 500 });
  }
}
