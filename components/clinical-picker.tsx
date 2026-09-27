"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ALLERGY_SEVERITY_LABELS, type SuggestionGroup } from "@/lib/clinical";

export type ClinicalItem = {
  label: string;
  reaction: string;
  severity: string;
  dosage: string;
  frequency: string;
  notes: string;
};

export const BLANK_ITEM: ClinicalItem = {
  label: "",
  reaction: "",
  severity: "",
  dosage: "",
  frequency: "",
  notes: "",
};

/** Which per-item detail inputs a picker shows behind its "Detail" toggle. */
export type DetailField = "reaction" | "severity" | "dosage" | "frequency" | "notes";

const DETAIL_META: Record<DetailField, { label: string; placeholder: string }> = {
  reaction: { label: "Reaction", placeholder: "Hives, swelling" },
  severity: { label: "Severity", placeholder: "" },
  dosage: { label: "Dosage", placeholder: "1 tablet" },
  frequency: { label: "Frequency", placeholder: "Twice daily" },
  notes: { label: "Notes", placeholder: "First noted 2015" },
};

type Status = "RECORDED" | "NONE_KNOWN" | "UNKNOWN";

// Matches the field style in components/form.tsx.
const CONTROL =
  "w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-base leading-6 text-ink " +
  "placeholder:text-ink-faint transition-colors hover:border-accent/50 " +
  "focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none";

/**
 * A search-and-tag picker for a clinical list.
 *
 * The catalogue is a shortcut, never a limit: whatever is typed can be added,
 * so a doctor is not blocked by a missing entry. "None known" and "Not asked"
 * are separate answers rather than an empty list, because clinically they are
 * different facts — the value travels in a hidden status field.
 */
export function ClinicalPicker({
  legend,
  fieldName,
  statusName,
  groups,
  placeholder,
  noneLabel,
  defaultStatus,
  defaultItems,
  detailFields = [],
  error,
}: {
  legend: string;
  /** Prefix for the repeated fields, e.g. "allergy" → `allergy.label`. */
  fieldName: string;
  /**
   * Field carrying the "recorded / none known / not asked" answer. Omit for a
   * list where an empty list simply means none — medical alerts, say, where
   * "nobody asked" is not a distinct clinical fact worth storing.
   */
  statusName?: string;
  groups: SuggestionGroup[];
  placeholder: string;
  noneLabel: string;
  defaultStatus: Status;
  defaultItems: ClinicalItem[];
  /** Per-item inputs revealed by the "Detail" toggle. Empty means tags only. */
  detailFields?: DetailField[];
  error?: string[];
}) {
  const [status, setStatus] = useState<Status>(defaultStatus);
  const [items, setItems] = useState<ClinicalItem[]>(defaultItems);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const hasDetail = detailFields.length > 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const chosen = useMemo(() => new Set(items.map((i) => i.label.toLowerCase())), [items]);
  const trimmed = query.trim();

  // Catalogue entries matching the query, minus anything already chosen.
  const matches = useMemo(() => {
    const needle = trimmed.toLowerCase();
    return groups
      .map((g) => ({
        group: g.group,
        items: g.items.filter(
          (i) => !chosen.has(i.toLowerCase()) && (needle === "" || i.toLowerCase().includes(needle)),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, trimmed, chosen]);

  const flat = useMemo(() => matches.flatMap((g) => g.items), [matches]);

  // Offer the typed text when it is not already an exact catalogue hit — this
  // is the "Other — specify" path, without a separate mode to switch into.
  const exact = flat.some((i) => i.toLowerCase() === trimmed.toLowerCase());
  const canAddCustom = trimmed.length > 0 && !exact && !chosen.has(trimmed.toLowerCase());
  const options = canAddCustom ? [...flat, trimmed] : flat;

  function add(label: string) {
    const clean = label.trim();
    if (!clean || chosen.has(clean.toLowerCase())) return;
    setItems((prev) => [...prev, { ...BLANK_ITEM, label: clean }]);
    setStatus("RECORDED");
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }

  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setExpanded(null);
  }

  function patch(index: number, change: Partial<ClinicalItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...change } : it)));
  }

  function setNoList(next: Status) {
    setStatus(next);
    setItems([]);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      // Never let the dropdown's Enter submit the surrounding form.
      e.preventDefault();
      if (options[active]) add(options[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && items.length > 0) {
      remove(items.length - 1);
    }
  }

  const listId = `${id}-list`;

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 block text-sm font-medium">{legend}</legend>

      {/* What the server reads. */}
      {statusName ? <input type="hidden" name={statusName} value={status} /> : null}
      {items.map((item, i) => (
        <div key={`${id}-hidden-${i}`}>
          <input type="hidden" name={`${fieldName}.label`} value={item.label} />
          {detailFields
            .filter((f) => f !== "notes")
            .map((f) => (
              <input key={f} type="hidden" name={`${fieldName}.${f}`} value={item[f]} />
            ))}
          <input type="hidden" name={`${fieldName}.notes`} value={item.notes} />
        </div>
      ))}

      {statusName ? (
        <div className="flex flex-wrap gap-1.5">
          <StatusChip
            label={noneLabel}
            active={status === "NONE_KNOWN"}
            onClick={() => setNoList(status === "NONE_KNOWN" ? "UNKNOWN" : "NONE_KNOWN")}
          />
          <StatusChip
            label="Unknown — not asked"
            active={status === "UNKNOWN"}
            onClick={() => setNoList("UNKNOWN")}
          />
        </div>
      ) : null}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className={CONTROL}
        />

        {open && options.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-card"
          >
            {matches.map((group) => (
              <li key={group.group}>
                <p className="px-3 pt-2 pb-1 text-xs font-semibold text-ink-muted">
                  {group.group}
                </p>
                <ul>
                  {group.items.map((item) => {
                    const index = options.indexOf(item);
                    return (
                      <li key={item}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={index === active}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => add(item)}
                          className={`block w-full px-3 py-1.5 text-left text-sm ${
                            index === active ? "bg-accent-soft text-accent-ink" : "hover:bg-surface-muted"
                          }`}
                        >
                          {item}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}

            {canAddCustom ? (
              <li className="border-t border-border">
                <button
                  type="button"
                  role="option"
                  aria-selected={active === options.length - 1}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(options.length - 1)}
                  onClick={() => add(trimmed)}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    active === options.length - 1
                      ? "bg-accent-soft text-accent-ink"
                      : "hover:bg-surface-muted"
                  }`}
                >
                  Add “{trimmed}” <span className="text-ink-faint">— not in the list</span>
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={`${id}-tag-${i}`} className="rounded-lg border border-border bg-surface-muted">
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
                {hasDetail ? (
                  <>
                    {summarise(item, detailFields) ? (
                      <span className="min-w-0 truncate text-xs text-ink-muted">
                        {summarise(item, detailFields)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === i ? null : i)}
                      className="rounded px-1.5 py-0.5 text-xs font-medium text-accent-ink hover:underline"
                    >
                      {expanded === i ? "Done" : "Detail"}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove ${item.label}`}
                  className="rounded px-1.5 text-ink-faint transition-colors hover:text-danger-ink"
                >
                  ×
                </button>
              </div>

              {hasDetail && expanded === i ? (
                <div className="grid gap-2 border-t border-border px-2.5 py-2 sm:grid-cols-3">
                  {detailFields.map((field) => (
                    <label key={field} className="text-xs">
                      <span className="mb-1 block font-medium text-ink-muted">
                        {DETAIL_META[field].label}
                      </span>
                      {field === "severity" ? (
                        <select
                          value={item.severity}
                          onChange={(e) => patch(i, { severity: e.target.value })}
                          className={CONTROL}
                        >
                          <option value="">Not recorded</option>
                          {Object.entries(ALLERGY_SEVERITY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={item[field]}
                          onChange={(e) => patch(i, { [field]: e.target.value })}
                          placeholder={DETAIL_META[field].placeholder}
                          className={CONTROL}
                        />
                      )}
                    </label>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {error?.[0] ? (
        <p className="text-xs text-danger-ink">{error[0]}</p>
      ) : (
        <p className="text-xs text-ink-faint">
          {!statusName
            ? "Type to search, or add anything not listed."
            : status === "NONE_KNOWN"
              ? `Recorded as ${noneLabel.toLowerCase()}.`
              : status === "UNKNOWN" && items.length === 0
                ? "Nothing recorded — this reads as “not asked”, not as “none”."
                : "Type to search, or add anything not listed."}
        </p>
      )}
    </fieldset>
  );
}

/** The compact line shown on a collapsed tag, e.g. "1 tablet · Twice daily". */
function summarise(item: ClinicalItem, fields: DetailField[]) {
  return fields
    .filter((f) => f !== "notes" && item[f])
    .map((f) => (f === "severity" ? ALLERGY_SEVERITY_LABELS[item.severity as "MILD"] : item[f]))
    .join(" · ");
}

function StatusChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent text-on-accent"
          : "border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
