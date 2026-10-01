"use client";

import { useActionState } from "react";
import { addFamilyAction } from "@/app/actions/portal";
import { Field, FieldGrid, FormError, Select, SubmitButton, TextInput } from "@/components/form";
import { EMPTY_FORM_STATE } from "@/lib/validation";

const RELATIONSHIPS = [
  ["CHILD", "Child"],
  ["SPOUSE", "Spouse"],
  ["PARENT", "Parent"],
  ["SIBLING", "Sibling"],
  ["GRANDPARENT", "Grandparent"],
  ["OTHER", "Other"],
] as const;

/** Somebody to book for: name, birthday, sex, who they are to you. */
export function FamilyForm() {
  const [state, action] = useActionState(addFamilyAction, EMPTY_FORM_STATE);
  const err = state.fieldErrors;
  return (
    <form action={action} className="space-y-4">
      {state.ok ? <p className="text-sm text-ok-ink">{state.message}</p> : <FormError message={state.message} />}
      <FieldGrid>
        <Field label="First name" htmlFor="firstName" error={err?.firstName} required>
          <TextInput id="firstName" name="firstName" autoComplete="off" invalid={Boolean(err?.firstName)} />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={err?.lastName} required>
          <TextInput id="lastName" name="lastName" autoComplete="off" invalid={Boolean(err?.lastName)} />
        </Field>
        <Field label="Middle name" htmlFor="middleName">
          <TextInput id="middleName" name="middleName" autoComplete="off" placeholder="Optional" />
        </Field>
        <Field label="Birthday" htmlFor="dateOfBirth" error={err?.dateOfBirth} required>
          <TextInput id="dateOfBirth" name="dateOfBirth" type="date" invalid={Boolean(err?.dateOfBirth)} />
        </Field>
        <Field label="Sex" htmlFor="sex" error={err?.sex} required>
          <Select id="sex" name="sex" defaultValue="FEMALE">
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
          </Select>
        </Field>
        <Field label="Who are they to you?" htmlFor="relationship" error={err?.relationship} required>
          <Select id="relationship" name="relationship" defaultValue="CHILD">
            {RELATIONSHIPS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>
      <SubmitButton pendingLabel="Adding…">Add to my family</SubmitButton>
    </form>
  );
}
