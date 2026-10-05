export type Note = { id: string; body: string; created_at: string };

export function NoteList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return <p className="muted">No notes yet.</p>;
  return (
    <div>
      {notes.map((n) => (
        // Plain text only. React escapes it, so markup in a note is shown, never run.
        <div key={n.id} className="card" data-testid="note" style={{ whiteSpace: "pre-wrap" }}>
          {n.body}
        </div>
      ))}
    </div>
  );
}
