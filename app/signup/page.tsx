import { signup } from "@/app/actions/auth";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <h1>Create your organisation</h1>
      {error && <p className="error" role="alert">Could not create that account.</p>}
      <form action={signup} className="stack">
        <input name="orgName" placeholder="Organisation name" required />
        <input name="email" type="email" placeholder="Work email" required />
        <input name="password" type="password" placeholder="Password (8+ characters)" minLength={8} required />
        <button type="submit">Create account</button>
      </form>
    </>
  );
}
