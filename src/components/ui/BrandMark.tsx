/**
 * Brand mark: two interlocking links inside a dark tile — a bridge motif that
 * reads at 36px and uses the gold accent rather than a featureless blob.
 */
export function BrandMark() {
  return (
    <span className="brand__mark" aria-hidden="true">
      <svg viewBox="0 0 28 28" fill="none" className="brand__glyph">
        <rect
          x="3.2"
          y="9"
          width="15"
          height="10"
          rx="5"
          stroke="currentColor"
          strokeWidth="2.3"
        />
        <rect
          x="9.8"
          y="9"
          width="15"
          height="10"
          rx="5"
          stroke="currentColor"
          strokeWidth="2.3"
        />
      </svg>
    </span>
  );
}
