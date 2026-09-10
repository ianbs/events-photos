import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const optionalValue = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const booleanEnvironmentValue = z.preprocess(
  (value) => {
    if (value === undefined || value === "") {
      return false;
    }

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    return value;
  },
  z.boolean(),
);

const serverEnvironmentShape = {
  ...publicEnvironmentSchema.shape,
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().max(15).default(15),
  STORAGE_PROVIDER: z.enum(["supabase", "s3"]).default("supabase"),
  S3_ENDPOINT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  S3_REGION: optionalValue.default("auto"),
  S3_BUCKET: optionalValue,
  S3_ACCESS_KEY_ID: optionalValue,
  S3_SECRET_ACCESS_KEY: optionalValue,
  S3_FORCE_PATH_STYLE: booleanEnvironmentValue,
};

function requireConfiguredS3(
  environment: Record<string, unknown>,
  context: z.RefinementCtx,
) {
  if (environment.STORAGE_PROVIDER !== "s3") {
    return;
  }

  for (const key of [
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ] as const) {
    if (environment[key] === undefined) {
      context.addIssue({
        code: "custom",
        message: `${key} is required when STORAGE_PROVIDER=s3`,
        path: [key],
      });
    }
  }
}

const serverEnvironmentSchema = z
  .object(serverEnvironmentShape)
  .superRefine(requireConfiguredS3);

const adminEnvironmentSchema = z.object({
  ...serverEnvironmentShape,
  SUPABASE_SECRET_KEY: optionalValue,
  SUPABASE_SERVICE_ROLE_KEY: optionalValue,
})
  .superRefine((environment, context) => {
    requireConfiguredS3(environment, context);

    if (
      environment.SUPABASE_SECRET_KEY === undefined &&
      environment.SUPABASE_SERVICE_ROLE_KEY === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "A server-only Supabase key is required",
        path: ["SUPABASE_SECRET_KEY"],
      });
    }
  })
  .transform(({ SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, ...environment }) => {
    const adminKey = SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY;

    if (adminKey === undefined) {
      throw new Error("Admin environment validation invariant failed");
    }

    return {
      ...environment,
      SUPABASE_ADMIN_KEY: adminKey,
    };
  });

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type AdminEnvironment = z.infer<typeof adminEnvironmentSchema>;

function parseEnvironment<TSchema extends z.ZodType>(
  schema: TSchema,
  values: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(values);

  if (result.success) {
    return result.data;
  }

  const invalidKeys = Array.from(
    new Set(result.error.issues.map((issue) => issue.path.join("."))),
  ).join(", ");

  // Values are intentionally omitted so configuration failures never leak secrets.
  throw new Error(`Invalid environment configuration: ${invalidKeys}`);
}

export function parsePublicEnvironment(values: unknown): PublicEnvironment {
  return parseEnvironment(publicEnvironmentSchema, values);
}

export function parseServerEnvironment(values: unknown): ServerEnvironment {
  return parseEnvironment(serverEnvironmentSchema, values);
}

export function parseAdminEnvironment(values: unknown): AdminEnvironment {
  return parseEnvironment(adminEnvironmentSchema, values);
}
