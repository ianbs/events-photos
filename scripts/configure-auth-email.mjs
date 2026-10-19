import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const smtp = {
  smtp_host: process.env.SMTP_HOST?.trim(),
  smtp_port: Number(process.env.SMTP_PORT || "587"),
  smtp_user: process.env.SMTP_USER?.trim(),
  smtp_pass: process.env.SMTP_PASS,
  smtp_admin_email: process.env.SMTP_ADMIN_EMAIL?.trim(),
  smtp_sender_name: process.env.SMTP_SENDER_NAME?.trim() || "Galeria de eventos",
};

try {
  if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_pass?.trim() || !emailPattern.test(smtp.smtp_admin_email || "")) {
    throw new Error("Preencha SMTP_HOST, SMTP_USER, SMTP_PASS e SMTP_ADMIN_EMAIL em .env.smtp.local.");
  }
  if (!Number.isInteger(smtp.smtp_port) || smtp.smtp_port < 1 || smtp.smtp_port > 65535) throw new Error("Porta SMTP inválida.");
  if (smtp.smtp_host === "smtp.gmail.com") smtp.smtp_pass = smtp.smtp_pass.replace(/\s+/g, "");
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    (await readFile(join(homedir(), ".supabase", "access-token"), "utf8")).trim();
  if (!token.startsWith("sbp_")) throw new Error("Autentique a CLI do Supabase ou configure SUPABASE_ACCESS_TOKEN.");
  const projectRef = (await readFile("supabase/.temp/project-ref", "utf8")).trim();
  const endpoint = "https://api.supabase.com/v1/projects/" + encodeURIComponent(projectRef) + "/config/auth";
  const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const currentResponse = await fetch(endpoint, { headers, signal: AbortSignal.timeout(15000) });
  if (!currentResponse.ok) throw new Error("Não foi possível consultar a configuração do Supabase.");
  const current = await currentResponse.json();
  const recoveryUrl = new URL("/admin/reset-password", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").toString();
  const redirects = new Set((current.uri_allow_list || "").split(",").map((item) => item.trim()).filter(Boolean));
  redirects.add(recoveryUrl);
  const response = await fetch(endpoint, {
    method: "PATCH", headers,
    body: JSON.stringify({ ...smtp, uri_allow_list: [...redirects].join(","), password_min_length: Math.max(current.password_min_length || 6, 12) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("O Supabase recusou a configuração SMTP. Verifique os dados e as permissões da conta.");
  const verificationResponse = await fetch(endpoint, { headers, signal: AbortSignal.timeout(15000) });
  if (!verificationResponse.ok) throw new Error("Não foi possível verificar a configuração.");
  const verified = await verificationResponse.json();
  if (verified.smtp_host !== smtp.smtp_host || verified.smtp_user !== smtp.smtp_user || verified.smtp_admin_email !== smtp.smtp_admin_email) {
    throw new Error("Os dados SMTP não foram confirmados pelo Supabase.");
  }
  console.log("SMTP configurado e verificado. Nenhuma mensagem foi enviada pelo comando.");
  console.log("No painel Usuários, use Enviar link para definir senha para testar o recebimento.");
} catch (error) {
  // Never print upstream responses, request headers or SMTP credentials.
  console.error(error instanceof Error && !error.message.includes("fetch") ? error.message : "Falha de conexão ao configurar o SMTP.");
  process.exitCode = 1;
}
