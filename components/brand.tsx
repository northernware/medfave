import Link from "next/link";

/*
 * The medfave pill-heart: two mirrored capsules that meet at their lower ends.
 *
 * Built from geometry, not traced from the logo artwork — the guidelines note
 * the selected logo is still a raster concept awaiting approved vector masters.
 * When those arrive, replace <HeartMark> and <Wordmark> here and nowhere else.
 * Per the guidelines: never stretch, rotate, outline, shadow or gradient it.
 */
export function HeartMark({
  className = "size-8",
  title,
  tone = "logo",
}: {
  className?: string;
  title?: string;
  /** "logo" follows the lockup rules; "accent" is the heart used as a graphic. */
  tone?: "logo" | "accent";
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g stroke={tone === "logo" ? "var(--logo-heart)" : "var(--accent)"} strokeWidth="12.5" strokeLinecap="round">
        <line x1="16" y1="23" x2="7.5" y2="14.5" />
        <line x1="16" y1="23" x2="24.5" y2="14.5" />
      </g>
    </svg>
  );
}

/*
 * Placeholder wordmark. The real one is custom artwork; the guidelines say not
 * to recreate it by typing the name, so this is a stand-in in the heading face
 * until the approved lockup is supplied as SVG.
 */
function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display text-[19px] leading-none font-semibold tracking-[-0.02em] text-[var(--logo-word)] ${className}`}
    >
      medfave
    </span>
  );
}

export function Brand({ href = "/", size = "default" }: { href?: string; size?: "default" | "large" }) {
  const large = size === "large";
  return (
    <Link href={href} aria-label="medfave home" className="inline-flex items-center gap-2">
      <HeartMark className={large ? "size-10" : "size-7"} />
      <Wordmark className={large ? "text-[24px]" : ""} />
    </Link>
  );
}
