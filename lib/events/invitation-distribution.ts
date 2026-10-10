import { DEFAULT_WHATSAPP_MESSAGE, renderInvitationMessage } from "./invitation-message-template";

export function createInvitationMessage(name: string, eventName: string, url: string, template: string | null = null) {
  return renderInvitationMessage(template || DEFAULT_WHATSAPP_MESSAGE, name, eventName, url);
}

export function createWhatsAppUrl(phone: string | null, message: string) {
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;
}

export function createInvitationCsv(rows: string[][]): string {
  const cell = (value: string) => {
    // CSV quoting alone does not prevent spreadsheet formula execution.
    const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
}
