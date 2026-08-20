import { Suspense, lazy } from "react";

/**
 * Code-split boundary in front of the Leaflet map.
 *
 * Leaflet + its CSS is ~150 kB that only three pages ever render, and each of
 * them renders it below the fold. Keeping it out of the entry chunk is pure
 * win. The public API is unchanged — call sites still `import GeoMap`.
 *
 * The real implementation lives in GeoMapCanvas.jsx.
 */
const GeoMapCanvas = lazy(() => import("./GeoMapCanvas.jsx"));

export default function GeoMap({ height = 260, className = "", ...props }) {
  return (
    <Suspense
      fallback={
        <div
          className={className}
          style={{ height, background: "var(--paper-2, #efe9dd)" }}
          aria-hidden="true"
        />
      }
    >
      <GeoMapCanvas height={height} className={className} {...props} />
    </Suspense>
  );
}
