"use client";

import { useActionState } from "react";

import {
  createEventAction,
  type CreateEventFormState,
} from "@/app/admin/(protected)/events/new/actions";
import { EventFormFields } from "@/components/event-form-fields";

const initialState: CreateEventFormState = { error: null };

export function CreateEventForm() {
  const [state, formAction, pending] = useActionState(
    createEventAction,
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
        pending={pending}
        pendingLabel="Criando evento..."
        submitLabel="Criar evento"
      />
    </form>
  );
}
