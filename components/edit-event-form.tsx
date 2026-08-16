"use client";

import { useActionState } from "react";

import {
  type EditEventFormState,
  updateEventAction,
} from "@/app/admin/(protected)/events/[eventId]/edit/actions";
import {
  EventFormFields,
  type EventFormValues,
} from "@/components/event-form-fields";

const initialState: EditEventFormState = { error: null };

type EditEventFormProps = {
  eventId: string;
  initialValues: EventFormValues;
};

export function EditEventForm({
  eventId,
  initialValues,
}: EditEventFormProps) {
  const updateCurrentEvent = updateEventAction.bind(null, eventId);
  const [state, formAction, pending] = useActionState(
    updateCurrentEvent,
    initialState,
  );

  return (
    <form action={formAction} className="mt-6 space-y-5">
      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <EventFormFields
        defaultValues={initialValues}
        pending={pending}
        pendingLabel="Salvando alterações..."
        showSlugChangeWarning
        submitLabel="Salvar alterações"
      />
    </form>
  );
}
