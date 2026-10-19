export type EventListStatus = "all" | "active" | "closed";
export type EventListSort = "recent" | "oldest" | "name" | "photos";

type ListableEvent = {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  eventDate: string;
  isActive: boolean;
  photoCount: number;
};

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function filterAndSortAdminEvents<T extends ListableEvent>(
  events: readonly T[],
  query: string,
  status: EventListStatus,
  sort: EventListSort,
): T[] {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return events.filter((event) => {
    if (status === "active" && !event.isActive) return false;
    if (status === "closed" && event.isActive) return false;
    const searchable = normalizeSearch([event.name, event.slug, event.location ?? "", event.eventDate].join(" "));
    return terms.every((term) => searchable.includes(term));
  }).sort((a, b) => {
    const byName = a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id);
    if (sort === "name") return byName;
    if (sort === "photos") return b.photoCount - a.photoCount || byName;
    if (sort === "oldest") return a.eventDate.localeCompare(b.eventDate) || byName;
    return b.eventDate.localeCompare(a.eventDate) || byName;
  });
}

export function formatEventListDate(value: string) {
  // A date-only event must not shift to the previous day in Brazilian timezones.
  const date = new Date(value + "T12:00:00Z");
  return {
    day: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "UTC" }).format(date),
    month: new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(date).replace(".", ""),
    full: new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(date),
  };
}

export function formatEventStorage(value: number): string {
  if (value === 0) return "0 MB";
  if (value < 1024 ** 2) return "< 1 MB";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
  return `${(value / 1024 ** 2).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
