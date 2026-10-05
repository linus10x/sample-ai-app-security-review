import { requireAuth } from "@/lib/auth";
import { ImportForm } from "@/components/ImportForm";

export default async function ImportPage() {
  await requireAuth();
  return (
    <>
      <h1>Import products from a URL</h1>
      <p className="muted">Point at a supplier feed (JSON) to preview what would be imported.</p>
      <ImportForm />
    </>
  );
}
