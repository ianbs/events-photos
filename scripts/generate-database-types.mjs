import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const result = spawnSync(
  "supabase",
  [
    "gen",
    "types",
    "typescript",
    "--project-id",
    "mqirdpopanmfiayojppx",
    "--schema",
    "public",
  ],
  { encoding: "utf8", shell: process.platform === "win32" },
);

if (result.status !== 0 || !result.stdout.trim()) {
  process.stderr.write(result.stderr || "Supabase type generation failed.\n");
  process.exit(result.status ?? 1);
}

writeFileSync("types/database.ts", result.stdout, "utf8");
process.stdout.write("Generated types/database.ts from the linked Supabase project.\n");
