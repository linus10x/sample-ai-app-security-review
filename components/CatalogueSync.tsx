"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Admin tool: clear this organisation's product notes in one click.
export function CatalogueSync({ orgId }: { orgId: string }) {
  const [msg, setMsg] = useState("");
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const db = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
          );
          const { error } = await db.from("product_notes").delete().eq("org_id", orgId);
          setMsg(error ? "Could not clear notes" : "Notes cleared");
        }}
      >
        Clear all notes
      </button>
      {msg && <span className="muted"> {msg}</span>}
    </>
  );
}
