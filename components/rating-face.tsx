/**
 * The app's rating faces, for the web: drawn the same way (medfave-mobile
 * features/rating-faces.tsx), coloured from the brand's emergency red at 1 to
 * its fuchsia at 5.
 */
const MOUTHS = ["", "M15 34 Q24 25 33 34", "M16 33 Q24 28.5 32 33", "M16 31 L32 31", "M16 29 Q24 35.5 32 29", "M14.5 27.5 Q24 40 33.5 27.5 Z"];

function blend(a: string, b: string, t: number) {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** Emergency red to fuchsia, from the brand tokens. */
export const faceColor = (score: number) => blend("#C62828", "#E91E83", (score - 1) / 4);

export function RatingFace({ score, size = 28 }: { score: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <circle cx={24} cy={24} r={22} fill={faceColor(score)} />
      {score === 1 ? (
        <>
          <path d="M13.5 15.5 L20 18" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
          <path d="M34.5 15.5 L28 18" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
        </>
      ) : null}
      <circle cx={17} cy={21} r={2.6} fill="#fff" />
      <circle cx={31} cy={21} r={2.6} fill="#fff" />
      <path
        d={MOUTHS[score]}
        stroke="#fff"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={score === 5 ? "#fff" : "none"}
      />
    </svg>
  );
}
