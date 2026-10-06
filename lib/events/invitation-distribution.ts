export function createInvitationMessage(name: string, eventName: string, url: string) {
  return `Olá, ${name}! Você está convidado(a) para ${eventName}. Confirme sua presença pelo seu link individual: ${url}`;
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
