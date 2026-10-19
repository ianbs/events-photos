import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Uso: pnpm admin:bootstrap EMAIL");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Configure a URL do Supabase e a chave privada em .env.local.");
  process.exit(1);
}
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

try {
  // Check the migration before creating an account.
  const { error: schemaError } = await client.from("admin_users").select("role, is_active").limit(0);
  if (schemaError) throw new Error("Aplique a migration add_super_admin_user_management antes de continuar.");

  let existing;
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error("Não foi possível consultar as contas.");
    existing = data.users.find((user) => user.email?.toLowerCase() === email);
    if (existing || !data.nextPage) break;
  }
  let password;
  if (!existing) {
    password = randomBytes(24).toString("base64url") + "aA1!";
    const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error("Não foi possível criar a conta.");
    existing = data.user;
  }

  const { error } = await client.from("admin_users").upsert({
    user_id: existing.id, role: "super_admin", is_active: true,
  });
  if (error) throw new Error("Não foi possível liberar o acesso. A conta pode existir; execute novamente para concluir.");
  const { data: verified, error: verifyError } = await client.from("admin_users")
    .select("role, is_active").eq("user_id", existing.id).single();
  if (verifyError || verified.role !== "super_admin" || !verified.is_active) {
    throw new Error("Não foi possível verificar a permissão.");
  }
  console.log("Superadministrador configurado: " + email);
  if (password) console.log("Senha inicial (guarde agora): " + password);
  else console.log("A senha existente foi preservada.");
  console.log("Acesso: " + (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "") + "/admin/login");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Falha na configuração.");
  process.exitCode = 1;
}
