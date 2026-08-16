"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApplicationError } from "@/lib/errors/application-error";
import { updateAdminEvent } from "@/lib/events/admin-event-service";

export type EditEventFormState = {
  error: string | null;
};

export async function updateEventAction(
  eventId: string,
  _previousState: EditEventFormState,
  formData: FormData,
): Promise<EditEventFormState> {
  try {
    await updateAdminEvent(eventId, {
      eventDate: String(formData.get("eventDate") ?? ""),
      isActive: formData.get("isActive") === "on",
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
    });
  } catch (error) {
    if (error instanceof ApplicationError) {
      return { error: error.message };
    }

    console.error("Unexpected event update failure");
    return { error: "Não foi possível atualizar o evento. Tente novamente." };
  }

  revalidatePath("/admin");
  revalidatePath(`/e/${String(formData.get("slug") ?? "")}`);
  redirect("/admin?event=updated");
}
