import { Field, TextInput } from "@/components/form";

/**
 * First, middle and last name, posted separately; the server joins and tidies
 * them into `fullName` (lib/names.ts). `defaultName` splits a known full name
 * (from Google, say) as a starting point: the last word as the last name.
 */
export function NameFields({ error, defaultName = "" }: { error?: string[]; defaultName?: string }) {
  const words = defaultName.trim().split(/\s+/).filter(Boolean);
  const first = words.length > 1 ? words.slice(0, -1).join(" ") : (words[0] ?? "");
  const last = words.length > 1 ? words[words.length - 1] : "";
  return (
    <div className="space-y-1.5">
      <div className="grid gap-3 sm:grid-cols-[1fr_0.8fr_1fr]">
        <Field label="First name" htmlFor="firstName" required>
          <TextInput id="firstName" name="firstName" autoComplete="given-name" autoCapitalize="words" defaultValue={first} required invalid={Boolean(error)} />
        </Field>
        <Field label="Middle name" htmlFor="middleName" hint="Optional">
          <TextInput id="middleName" name="middleName" autoComplete="additional-name" autoCapitalize="words" />
        </Field>
        <Field label="Last name" htmlFor="lastName" required>
          <TextInput id="lastName" name="lastName" autoComplete="family-name" autoCapitalize="words" defaultValue={last} required invalid={Boolean(error)} />
        </Field>
      </div>
      {error ? <p className="text-sm text-danger-ink">{error[0]}</p> : null}
    </div>
  );
}
