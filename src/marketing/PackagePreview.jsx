import { PackageViewerProvider } from "../context/PackageViewerContext";
import PackagePage from "./PackagePage";

/**
 * Dashboard editor preview — renders the real marketing package page (hero,
 * route timeline, booking flow…) from the editor's in-memory draft. The
 * booking wizard opens for real but its submit is disabled in preview mode.
 */
export default function MarketingPackagePreview({ data, doc }) {
  const previewDoc = {
    $id: doc?.$id || "preview",
    title: doc?.title || data?._name || "",
    basePrice: doc?.basePrice ?? data?.basePrice ?? 0,
    country: doc?.country || data?.country || "",
    data,
  };
  return (
    <PackageViewerProvider>
      <PackagePage previewDoc={previewDoc} />
    </PackageViewerProvider>
  );
}
