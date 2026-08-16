const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  console.error(
    "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY em .env.local.",
  );
  process.exit(1);
}

let settingsUrl;

try {
  settingsUrl = new URL("/auth/v1/settings", supabaseUrl);
} catch {
  console.error("NEXT_PUBLIC_SUPABASE_URL não contém uma URL válida.");
  process.exit(1);
}

try {
  const response = await fetch(settingsUrl, {
    headers: {
      apikey: publishableKey,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    console.error(
      `Supabase respondeu com HTTP ${response.status}. Confira a URL e a publishable key.`,
    );
    process.exit(1);
  }

  console.log("Conexão com Supabase validada com sucesso.");
} catch (error) {
  const message = error instanceof Error ? error.message : "erro desconhecido";
  console.error(`Não foi possível conectar ao Supabase: ${message}`);
  process.exit(1);
}
