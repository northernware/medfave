"use client";

import { useActionState } from "react";
import { Field, FieldGrid, FormError, Select, SubmitButton, TextInput } from "@/components/form";
import {
  describeNotice,
  NOTICE_OPTIONS,
  SLOT_STEPS,
  timeValue,
  WEEKDAY_NAMES,
} from "@/lib/schedule-options";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/** Monday first, the way a clinic's week reads; Sunday last. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function OpeningHoursForm({
  action,
  hours,
  submitLabel = "Save opening hours",
}: {
  action: Action;
  hours: { weekday: number; openMinute: number; closeMinute: number }[];
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state.message} />
      <ul className="divide-y divide-border rounded-lg border border-border">
        {WEEK_ORDER.map((weekday) => {
          const day = hours.find((h) => h.weekday === weekday);
          const problem = err?.[`day-${weekday}`]?.[0];
          return (
            <li key={weekday} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
              <label className="flex w-36 items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name={`open-${weekday}`}
                  defaultChecked={Boolean(day)}
                  className="size-4 accent-accent"
                />
                {WEEKDAY_NAMES[weekday]}
              </label>
              <span className="flex w-full items-center gap-2 text-sm text-ink-muted sm:w-auto">
                <TextInput
                  type="time"
                  step={300}
                  name={`from-${weekday}`}
                  aria-label={`${WEEKDAY_NAMES[weekday]} opens`}
                  defaultValue={timeValue(day?.openMinute ?? 8 * 60)}
                  invalid={Boolean(problem)}
                  className="min-w-0 flex-1 sm:w-32 sm:flex-none"
                />
                to
                <TextInput
                  type="time"
                  step={300}
                  name={`to-${weekday}`}
                  aria-label={`${WEEKDAY_NAMES[weekday]} closes`}
                  defaultValue={timeValue(day?.closeMinute ?? 17 * 60)}
                  invalid={Boolean(problem)}
                  className="min-w-0 flex-1 sm:w-32 sm:flex-none"
                />
              </span>
              {problem ? <span className="text-xs text-danger-ink">{problem}</span> : null}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-muted">
        Untick a day to close on it every week. For a holiday or leave, add a closure instead.
      </p>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

export function BreakForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state.message} />
      <FieldGrid>
        <Field label="What it is" htmlFor="break-label" error={err?.label} required>
          <TextInput id="break-label" name="label" placeholder="Lunch" invalid={Boolean(err?.label)} />
        </Field>
        <Field label="When" htmlFor="break-weekday" error={err?.weekday}>
          <Select id="break-weekday" name="weekday" defaultValue="">
            <option value="">Every open day</option>
            {WEEK_ORDER.map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_NAMES[d]}s only
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From" htmlFor="break-from" error={err?.from} required>
          <TextInput id="break-from" name="from" type="time" step={300} defaultValue="12:00" invalid={Boolean(err?.from)} />
        </Field>
        <Field label="To" htmlFor="break-to" error={err?.to} required>
          <TextInput id="break-to" name="to" type="time" step={300} defaultValue="13:00" invalid={Boolean(err?.to)} />
        </Field>
      </FieldGrid>
      <SubmitButton>Add break</SubmitButton>
    </form>
  );
}

export function ClosureForm({ action, today }: { action: Action; today: string }) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state.message} />
      <Field
        label="Reason"
        htmlFor="closure-reason"
        error={err?.reason}
        hint="Shown to anybody who tries to book that day."
        required
      >
        <TextInput
          id="closure-reason"
          name="reason"
          placeholder="Holiday — Independence Day"
          invalid={Boolean(err?.reason)}
        />
      </Field>
      <FieldGrid>
        <Field label="From" htmlFor="closure-start" error={err?.startsOn} required>
          <TextInput id="closure-start" name="startsOn" type="date" min={today} invalid={Boolean(err?.startsOn)} />
        </Field>
        <Field label="Until" htmlFor="closure-end" error={err?.endsOn} hint="Leave blank for a single day.">
          <TextInput id="closure-end" name="endsOn" type="date" min={today} invalid={Boolean(err?.endsOn)} />
        </Field>
        <Field label="Starting at" htmlFor="closure-from" error={err?.from} hint="Blank for the whole day.">
          <TextInput id="closure-from" name="from" type="time" step={300} invalid={Boolean(err?.from)} />
        </Field>
        <Field label="Ending at" htmlFor="closure-to" error={err?.to}>
          <TextInput id="closure-to" name="to" type="time" step={300} invalid={Boolean(err?.to)} />
        </Field>
      </FieldGrid>
      <SubmitButton>Add closure</SubmitButton>
    </form>
  );
}

export function ServiceLengthsForm({
  action,
  services,
}: {
  action: Action;
  services: { value: string; label: string; builtIn: number; override: number | null }[];
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state.message} />
      <ul className="divide-y divide-border rounded-lg border border-border">
        {services.map((s) => {
          const problem = err?.[`minutes-${s.value}`]?.[0];
          return (
            <li key={s.value} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
              <label htmlFor={`minutes-${s.value}`} className="min-w-0 flex-1 text-sm">
                {s.label}
              </label>
              <span className="flex items-center gap-2 text-xs text-ink-muted">
                <TextInput
                  id={`minutes-${s.value}`}
                  name={`minutes-${s.value}`}
                  type="number"
                  min={5}
                  max={240}
                  step={5}
                  defaultValue={s.override ?? ""}
                  placeholder={String(s.builtIn)}
                  invalid={Boolean(problem)}
                  className="w-20 text-right"
                />
                min
              </span>
              {problem ? <span className="w-full text-xs text-danger-ink">{problem}</span> : null}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-muted">
        Blank uses the standard length shown in grey. Changes apply to new bookings; visits already
        booked keep the length they were booked with.
      </p>
      <SubmitButton>Save lengths</SubmitButton>
    </form>
  );
}

export function BookingRulesForm({
  action,
  rules,
}: {
  action: Action;
  rules: { slotStepMinutes: number; minLeadMinutes: number; maxLeadDays: number };
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;
  const notice = NOTICE_OPTIONS.includes(rules.minLeadMinutes)
    ? NOTICE_OPTIONS
    : [...NOTICE_OPTIONS, rules.minLeadMinutes].sort((a, b) => a - b);
  const steps = SLOT_STEPS.includes(rules.slotStepMinutes)
    ? SLOT_STEPS
    : [...SLOT_STEPS, rules.slotStepMinutes].sort((a, b) => a - b);

  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state.message} />
      <FieldGrid>
        <Field
          label="Start times every"
          htmlFor="slotStepMinutes"
          error={err?.slotStepMinutes}
          hint="How finely the day is offered."
        >
          <Select id="slotStepMinutes" name="slotStepMinutes" defaultValue={String(rules.slotStepMinutes)}>
            {steps.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Notice needed"
          htmlFor="minLeadMinutes"
          error={err?.minLeadMinutes}
          hint="Walk-ins at the desk are not held to this."
        >
          <Select id="minLeadMinutes" name="minLeadMinutes" defaultValue={String(rules.minLeadMinutes)}>
            {notice.map((m) => (
              <option key={m} value={m}>
                {describeNotice(m)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Book up to"
          htmlFor="maxLeadDays"
          error={err?.maxLeadDays}
          hint="Days ahead."
        >
          <TextInput
            id="maxLeadDays"
            name="maxLeadDays"
            type="number"
            min={1}
            max={365}
            defaultValue={rules.maxLeadDays}
            invalid={Boolean(err?.maxLeadDays)}
          />
        </Field>
      </FieldGrid>
      <SubmitButton>Save booking rules</SubmitButton>
    </form>
  );
}
