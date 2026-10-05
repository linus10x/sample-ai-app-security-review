"use client";

import { useState } from "react";

export function ImportForm() {
  const [url, setUrl] = useState("");
  const [out, setOut] = useState<unknown>(null);
  return (
    <>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await fetch("/api/import", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url }),
          });
          setOut(await res.json());
        }}
      >
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://supplier.example.com/feed.json" required />
        <button type="submit">Preview feed</button>
      </form>
      {out !== null && <pre data-testid="import-result">{JSON.stringify(out, null, 2)}</pre>}
    </>
  );
}
