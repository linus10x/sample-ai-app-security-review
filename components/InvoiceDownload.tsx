"use client";

import { useState } from "react";
import { downloadInvoice, type InvoiceDownload as Result } from "@/app/actions/invoices";

export function InvoiceDownload({ invoiceId }: { invoiceId: string }) {
  const [result, setResult] = useState<Result | null>(null);
  return (
    <>
      <button type="button" onClick={async () => setResult(await downloadInvoice(invoiceId))}>
        Download invoice
      </button>
      {result?.ok === true && <pre data-testid="invoice-text">{result.text}</pre>}
      {result?.ok === false && <p className="error" data-testid="invoice-error">{result.error}</p>}
    </>
  );
}
