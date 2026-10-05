"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApplicationError } from "@/lib/errors/application-error";
import { createAdminEvent } from "@/lib/events/admin-event-service";

export type CreateEventFormState = {
  error: string | null;
};

export async function createEventAction(
  _previousState: CreateEventFormState,
  formData: FormData,
): Promise<CreateEventFormState> {
  try {
    await createAdminEvent({
      availabilityUntil: String(formData.get("availabilityUntil") ?? ""),
      closingMessage: String(formData.get("closingMessage") ?? ""),
      eventDate: String(formData.get("eventDate") ?? ""),
      isActive: formData.get("isActive") === "on",
      name: String(formData.get("name") ?? ""),
      organizerContact: String(formData.get("organizerContact") ?? ""),
      slug: String(formData.get("slug") ?? ""),
    });
  } catch (error) {
    if (error instanceof ApplicationError) {
      return { error: error.message };
    }

    console.error("Unexpected event creation failure");
    return { error: "Não foi possível criar o evento. Tente novamente." };
  }

  revalidatePath("/admin");
  redirect("/admin?status=created");
}
