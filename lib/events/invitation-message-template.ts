export const DEFAULT_WHATSAPP_MESSAGE =
  "Olá, {nome}! Você está convidado(a) para {evento}. Confirme sua presença pelo seu link individual: {link}";

export function renderInvitationMessage(template: string, name: string, eventName: string, url: string) {
  const values: Record<string, string> = { nome: name, evento: eventName, link: url };
  const message = template.replace(/\{(nome|evento|link)\}/g, (_, key: string) => values[key]);
  return template.includes("{link}") ? message : `${message}\n\n${url}`;
}
