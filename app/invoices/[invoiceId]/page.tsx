import { requireAuth } from "@/lib/auth";
import { InvoiceDownload } from "@/components/InvoiceDownload";

export default async function InvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  await requireAuth();
  return (
    <>
      <h1>Invoice</h1>
      <InvoiceDownload invoiceId={invoiceId} />
    </>
  );
}
