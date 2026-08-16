import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.fn();
const createAdminSupabaseClient = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin-authorization", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient }));

const validInput = {
  eventDate: "2026-08-16",
  isActive: true,
  name: "Evento de teste",
  slug: "evento-de-teste",
};

function createInsertClient(result: unknown) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));

  return { client: { from }, from, insert };
}

function createUpdateClient(result: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));

  return { client: { from }, eq, update };
}

describe("admin event creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ userId: "admin-id" });
  });

  it("does not touch the database when authorization fails", async () => {
    requireAdmin.mockRejectedValue(new Error("unauthorized"));
    const { createAdminEvent } = await import("./admin-event-service");

    await expect(createAdminEvent(validInput)).rejects.toThrow("unauthorized");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("maps a duplicate slug to a conflict", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "23505" },
    });
    createAdminSupabaseClient.mockReturnValue(client);
    const { createAdminEvent } = await import("./admin-event-service");

    await expect(createAdminEvent(validInput)).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
  });

  it("creates a validated event", async () => {
    const { client, insert } = createInsertClient({
      data: {
        event_date: "2026-08-16",
        id: "11111111-1111-4111-8111-111111111111",
        is_active: true,
        name: "Evento de teste",
        slug: "evento-de-teste",
      },
      error: null,
    });
    createAdminSupabaseClient.mockReturnValue(client);
    const { createAdminEvent } = await import("./admin-event-service");

    await expect(createAdminEvent(validInput)).resolves.toMatchObject({
      name: "Evento de teste",
      slug: "evento-de-teste",
    });
    expect(insert).toHaveBeenCalledWith({
      event_date: "2026-08-16",
      is_active: true,
      name: "Evento de teste",
      slug: "evento-de-teste",
    });
  });
});

describe("admin event update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ userId: "admin-id" });
  });

  it("does not touch the database when authorization fails", async () => {
    requireAdmin.mockRejectedValue(new Error("unauthorized"));
    const { updateAdminEvent } = await import("./admin-event-service");

    await expect(
      updateAdminEvent("11111111-1111-4111-8111-111111111111", validInput),
    ).rejects.toThrow("unauthorized");
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("updates only the event identified by UUID", async () => {
    const { client, eq, update } = createUpdateClient({
      data: {
        event_date: "2026-08-16",
        id: "11111111-1111-4111-8111-111111111111",
        is_active: false,
        name: "Evento atualizado",
        slug: "evento-atualizado",
      },
      error: null,
    });
    createAdminSupabaseClient.mockReturnValue(client);
    const { updateAdminEvent } = await import("./admin-event-service");
    const updatedInput = {
      ...validInput,
      isActive: false,
      name: "Evento atualizado",
      slug: "evento-atualizado",
    };

    await expect(
      updateAdminEvent(
        "11111111-1111-4111-8111-111111111111",
        updatedInput,
      ),
    ).resolves.toMatchObject(updatedInput);
    expect(eq).toHaveBeenCalledWith(
      "id",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(update).toHaveBeenCalledWith({
      event_date: "2026-08-16",
      is_active: false,
      name: "Evento atualizado",
      slug: "evento-atualizado",
    });
  });

  it("maps a duplicate slug to a conflict", async () => {
    const { client } = createUpdateClient({
      data: null,
      error: { code: "23505" },
    });
    createAdminSupabaseClient.mockReturnValue(client);
    const { updateAdminEvent } = await import("./admin-event-service");

    await expect(
      updateAdminEvent("11111111-1111-4111-8111-111111111111", validInput),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });
});
