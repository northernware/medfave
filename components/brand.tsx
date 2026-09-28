import Link from "next/link";
import {
  HEART_CAPSULE,
  HEART_VIEWBOX,
  LOCKUP_HEART_TRANSFORM,
  LOCKUP_VIEWBOX,
  LOCKUP_WORDMARK_TRANSFORM,
  WORDMARK,
} from "./logo-paths";

/*
 * The medfave logo, from the approved artwork in the brand repo
 * (northernware/medfave-design). The shapes are copied in `logo-paths.ts`; the
 * colours come from the theme (`--logo-heart`, `--logo-word`), so the lockup is
 * fuchsia and plum on light and the single-colour white version on dark.
 * Per the guidelines: never stretch, rotate, outline, shadow or gradient it,
 * and never retype the wordmark in a font.
 */

/** The two capsules of the pill-heart, drawn in the heart's own coordinates. */
function Capsules({ fill }: { fill: string }) {
  return (
    <>
      <path d={HEART_CAPSULE} fill={fill} transform="translate(50 70) rotate(-45)" />
      <path d={HEART_CAPSULE} fill={fill} transform="translate(50 70) rotate(45)" />
    </>
  );
}

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
      viewBox={HEART_VIEWBOX}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <Capsules fill={tone === "logo" ? "var(--logo-heart)" : "var(--accent)"} />
    </svg>
  );
}

/** Heart + wordmark, as one piece of artwork. Size it by height; width follows. */
export function Lockup({ className = "h-7 w-auto" }: { className?: string }) {
  return (
    <svg viewBox={LOCKUP_VIEWBOX} className={className} aria-hidden="true">
      <g transform={LOCKUP_HEART_TRANSFORM}>
        <Capsules fill="var(--logo-heart)" />
      </g>
      <g transform={LOCKUP_WORDMARK_TRANSFORM}>
        <path d={WORDMARK} fill="var(--logo-word)" fillRule="evenodd" />
      </g>
    </svg>
  );
}

export function Brand({ href = "/", size = "default" }: { href?: string; size?: "default" | "large" }) {
  // The guidelines' minimum for the full logo is 140px wide: 26px tall here.
  return (
    <Link href={href} aria-label="medfave home" className="inline-flex items-center">
      <Lockup className={size === "large" ? "h-9 w-auto" : "h-[26px] w-auto"} />
    </Link>
  );
}
