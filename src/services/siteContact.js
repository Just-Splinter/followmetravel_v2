// Contact-page settings (the three office photos) live in the `products`
// collection as a singleton document with data.kind = "site-contact" — the
// same backend-without-a-new-collection pattern as hero slides and omra.

export const CONTACT_KIND = "site-contact";

export const DEFAULT_OFFICE_IMAGES = [
  "/office/office-1.jpg",
  "/office/office-2.jpg",
  "/office/office-3.jpg",
];

export function parseContact(doc) {
  try {
    const data = typeof doc.data === "string" ? JSON.parse(doc.data) : doc.data;
    if (data?.kind !== CONTACT_KIND) return null;
    return { $id: doc.$id, ...data };
  } catch {
    return null;
  }
}

export function isContactDoc(doc) {
  return parseContact(doc) !== null;
}

/** The singleton contact settings from the raw products array (or null). */
export function contactFromPackages(packages) {
  for (const doc of packages || []) {
    const c = parseContact(doc);
    if (c) return c;
  }
  return null;
}

/** Office image URLs with local fallbacks for any empty slot. */
export function officeImages(contact) {
  return DEFAULT_OFFICE_IMAGES.map((fb, i) => contact?.images?.[i]?.trim() || fb);
}

export function contactDocumentAttrs(info) {
  return {
    title: "Site — Contact",
    category: "destinations",
    status: "draft", // never surfaces as a package anywhere
    basePrice: 0,
    tags: [],
    data: JSON.stringify({ kind: CONTACT_KIND, ...info, $id: undefined }),
  };
}
