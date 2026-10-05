Sample: Security review of an AI-built Next.js, Supabase, Stripe app

Reviewer and lead developer (illustrative sample on synthetic data)

Sample on synthetic data. A B2B ordering app built fast with AI coding tools gets an independent security and code review before real customer and card data goes in. I seeded ten realistic flaws, among them open row-level security, a leaked service key, an unsigned Stripe webhook and client-set prices. Each has an exploit test that fails before the fix and passes after. Output: a written findings report ranked by severity, one fix per finding, and a CI check that fails if any flaw returns.
