const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secret) {
  console.error("Configure a URL do Supabase e a chave privada do servidor.");
  process.exit(1);
}

console.log(`Supabase: ${new URL(url).hostname}`);
for (const table of ["events", "guests", "event_rsvps"]) {
  try {
    const endpoint = new URL(`/rest/v1/${table}`, url);
    endpoint.searchParams.set("select", "*");
    endpoint.searchParams.set("limit", "0");
    const response = await fetch(endpoint, {
      headers: { apikey: secret, Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json().catch(() => null);
    // Never print rows, credentials, request headers or raw upstream errors.
    console.log(JSON.stringify({ table, status: response.status, code: typeof body?.code === "string" ? body.code : null }));
    if (!response.ok) process.exitCode = 1;
  } catch {
    console.error(JSON.stringify({ table, error: "connection_failed" }));
    process.exitCode = 1;
  }
}
