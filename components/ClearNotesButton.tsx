"use client";

import { useState } from "react";
import { clearOrgNotes } from "@/app/actions/admin";

export function ClearNotesButton() {
  const [msg, setMsg] = useState("");
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const result = await clearOrgNotes();
          setMsg(result.ok ? "Notes cleared" : result.error);
        }}
      >
        Clear all notes
      </button>
      {msg && <span className="muted"> {msg}</span>}
    </>
  );
}
