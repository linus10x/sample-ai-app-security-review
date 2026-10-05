export type Note = { id: string; body: string; created_at: string };

export function NoteList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return <p className="muted">No notes yet.</p>;
  return (
    <div>
      {notes.map((n) => (
        // notes can include basic HTML formatting such as <b> and <i>
        <div key={n.id} className="card" data-testid="note" dangerouslySetInnerHTML={{ __html: n.body }} />
      ))}
    </div>
  );
}
