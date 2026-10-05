import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { CatalogueSync } from "@/components/CatalogueSync";

export default async function AdminPage() {
  const auth = await requireAuth();
  if (auth.role !== "admin") notFound();
  const { data: members } = await auth.db.from("profiles").select("user_id, role, full_name");
  return (
    <>
      <h1>Admin</h1>
      <p className="muted">{members?.length ?? 0} people in your organisation.</p>
      <table>
        <thead><tr><th>Name</th><th>Role</th></tr></thead>
        <tbody>
          {(members ?? []).map((m) => (
            <tr key={m.user_id}><td>{m.full_name ?? "(no name)"}</td><td>{m.role}</td></tr>
          ))}
        </tbody>
      </table>
      <h2>Tools</h2>
      <CatalogueSync orgId={auth.orgId} />
    </>
  );
}
