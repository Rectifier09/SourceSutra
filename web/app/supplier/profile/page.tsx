import { redirect } from "next/navigation";

// Merged into the main /supplier profile view (Company basics card, ?section=basics
// for editing) — this route only exists to catch old bookmarks/links.
export default function SupplierProfileRedirect() {
  redirect("/supplier?section=basics");
}
