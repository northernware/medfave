/** A plain GET form — search survives with JavaScript off and is linkable. */
export function SearchForm({
  action,
  placeholder,
  defaultValue,
  keep,
}: {
  action: string;
  placeholder: string;
  defaultValue?: string;
  /**
   * Other parameters to carry through a search. A GET form replaces the query
   * string in its action, so anything that should survive goes here instead.
   */
  keep?: Record<string, string>;
}) {
  return (
    <form action={action} role="search" className="flex gap-2">
      {Object.entries(keep ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full max-w-sm rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] placeholder:text-ink-faint hover:border-border-strong focus:border-accent"
      />
      <button className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink">
        Search
      </button>
    </form>
  );
}
