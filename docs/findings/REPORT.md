# Findings report: Cedar Supply Portal

Sample on synthetic data. Cedar Supply Portal is a made-up B2B ordering app, built to look like something put together quickly with AI coding tools. This is an illustrative review. It is not a penetration test, and it is not a certification of anything.

<div id="summary"></div>

## Summary

I seeded ten flaws into the app as first shipped (tag `v0-as-shipped`), wrote an exploit test for each one, and fixed each on `main` in its own commit. Every exploit test fails on the old code and passes on the new code, and a CI job checks both directions on every push.

| ID | Finding | Severity | Status |
|---|---|---|---|
| F01 | Orders readable across organizations | High | Fixed, retest passed |
| F02 | Service role key in the browser bundle | High | Fixed, retest passed |
| F03 | Stripe webhook accepts unsigned events | High | Fixed, retest passed |
| F05 | Prices taken from the browser | High | Fixed, retest passed |
| F07 | Import from URL reaches internal addresses | High | Fixed, retest passed |
| F04 | Replayed webhook fulfills twice | Medium | Fixed, retest passed |
| F06 | Invoice download has no ownership check | Medium | Fixed, retest passed |
| F08 | Stored script injection in product notes | Medium | Fixed, retest passed |
| F09 | Errors return stack traces and SQL | Low | Fixed, retest passed |
| F10 | No security headers | Low | Fixed, retest passed |

Severity here means the damage if someone found the flaw on a live system holding real data. High is a direct route to other customers' data, money, or the whole database. Medium needs a valid account or another condition first. Low helps an attacker but does not open a door by itself.

## Findings, ranked by severity

### F01. Orders readable across organizations (High)

- **Why High:** any signed-in user could read every organization's orders straight from the database API.
- **Where (v0):** `supabase/migrations/20261001000000_init.sql:83`, `alter table public.orders disable row level security`.
- **Reproduce:** `tests/exploits/f01-rls-orders.test.ts`. It signs in as a Harbor user and asks for all orders.
- **Fix:** commit `9a530f4`. Row level security is on, with a select policy and an insert policy scoped to the caller's organization. Access for the anonymous role is revoked. A pgTAP test (`supabase/tests/f01_orders_rls.test.sql`) covers the policies at the database level.
- **Retest:** the exploit test fails on `v0-as-shipped` and passes on `main`.
- **In plain words:** the app filtered orders by organization in its own code, but the database would hand everything to anyone who asked it directly. The database now enforces the rule itself.

### F02. Service role key in the browser bundle (High)

- **Why High:** that key skips every row level security rule. Anyone who opens the page source could use it against the whole database.
- **Where (v0):** `components/CatalogueSync.tsx:14`, a client component that builds a database client from a `NEXT_PUBLIC_` variable.
- **Reproduce:** `tests/exploits/f02-service-key-in-bundle.test.ts` scans every file under `.next/static` for the key and for its name.
- **Fix:** commit `b42ee09`. The admin action now runs on the server only, and the admin client imports `server-only`, so a client component that imports it stops the build. `scripts/check-bundle.sh` repeats the scan as a build step in CI.
- **Retest:** the exploit test fails on `v0-as-shipped` and passes on `main`. I also confirmed by hand that importing the admin client from a client component breaks the build.
- **In plain words:** an admin tool called the database from the browser with the master key. Admin work now happens on the server, and the build refuses to ship the key by accident. Any real key that ever sat in a bundle like this should be rotated.

### F03. Stripe webhook accepts unsigned events (High)

- **Why High:** anyone who can reach the URL could mark any order as paid.
- **Where (v0):** `app/api/stripe/webhook/route.ts:8`, `JSON.parse(await req.text())` with no signature check.
- **Reproduce:** `tests/exploits/f03-unsigned-webhook.test.ts` posts an unsigned event and a forged one, then a correctly signed one.
- **Fix:** commit `7b051ec`. The handler reads the raw body and calls `stripe.webhooks.constructEvent` with the signing secret, and answers 400 when the check fails.
- **Retest:** the exploit test fails on `v0-as-shipped` and passes on `main`. The test also checks that a correctly signed event still works, so a broken endpoint cannot pass by rejecting everything.
- **In plain words:** the app believed whatever the internet told it about payments. It now accepts only messages Stripe has signed.

### F05. Prices taken from the browser (High)

- **Why High:** a shopper could pay any amount for any item.
- **Where (v0):** `app/api/checkout/route.ts:23`, the order total is built from `unitAmount` in the request body, and the same value goes to Stripe.
- **Reproduce:** `tests/exploits/f05-client-price.test.ts` orders two units with a price of one cent and compares the stored total with the catalog price.
- **Fix:** commit `7a147a0`. The browser sends only a product id and a quantity. The server looks the price up and sends Stripe the stored Price ID. The request body is validated, and unknown fields, such as a price, are dropped.
- **Retest:** the exploit test fails on `v0-as-shipped` and passes on `main`.
- **In plain words:** the cart told the server what things cost. Now the server decides.

### F07. Import from URL reaches internal addresses (High)

- **Why High:** a signed-in user could make the server call internal services or a cloud metadata address and read the answer.
- **Where (v0):** `app/api/import/route.ts:11`, `fetch(url)` on a caller-supplied address.
- **Reproduce:** `tests/exploits/f07-ssrf-import.test.ts` starts a listener on the loopback address and asks the app to import from it.
- **Fix:** commit `e8b572b`. Only `https` on the default port, only hosts on an allowlist, no credentials in the URL, no redirects, a five second timeout and a size cap. The connection itself refuses private and loopback addresses, which also covers a name that resolves to one. I checked that last case by hand with an allowlisted name that resolves to the loopback address.
- **Retest:** the exploit test fails on `v0-as-shipped` and passes on `main`. Unit tests cover the address ranges, including the IPv6 forms.
- **In plain words:** the import feature would fetch anything, including addresses that only the server can see. It now fetches only from a short list of approved hosts, and never from inside your network.

### F04. Replayed webhook fulfills twice (Medium)

- **Why Medium:** it needs a valid event to replay, and Stripe itself retries events, so duplicates happen in normal operation.
- **Where (v0):** `app/api/stripe/webhook/route.ts:15`, shipment and invoice rows are inserted on every delivery.
- **Reproduce:** `tests/exploits/f04-webhook-replay.test.ts` sends the same signed event twice and counts shipments and invoices.
- **Fix:** commit `0dd3c92`. A `processed_events` table keyed by the Stripe event id, and a database function that records the event and fulfills the order in one transaction. A failure rolls both back, so Stripe can retry. A replay does nothing.
- **Retest:** the exploit test fails on `v0-as-shipped` and passes on `main`.
- **In plain words:** if Stripe sent the same message twice, the customer got two shipments. Now the second copy is ignored.

### F06. Invoice download has no ownership check (Medium)

- **Why Medium:** the attacker needs the invoice's id, which is a random UUID, but nothing stops a leaked or logged id from working.
- **Where (v0):** `app/actions/invoices.ts:10`, a service role lookup by id with no organization check.
- **Reproduce:** `tests/exploits/f06-invoice-idor.test.ts` signs in through a real browser as a Harbor user and opens a Birchwood invoice.
- **Fix:** commit `5f36c56`. The lookup runs as the user, so row level security applies, and an explicit organization check follows. Another organization's invoice and a missing invoice give the same answer.
- **Retest:** the exploit test fails on `v0-as-shipped` and passes on `main`. The test also checks that the owner can still download their own invoice.
- **In plain words:** knowing an invoice number was enough to read it. Now you also have to belong to the organization it was issued to.

### F08. Stored script injection in product notes (Medium)

- **Why Medium:** it needs an account, but a note written by one team member runs in the browser of everyone who opens the page, an admin included.
- **Where (v0):** `components/NoteList.tsx:9`, `dangerouslySetInnerHTML` on the note body.
- **Reproduce:** `tests/exploits/f08-stored-xss.test.ts` saves a note containing an image tag with an error handler and checks whether the handler runs.
- **Fix:** commit `a96d32f`. Notes render as text, so markup is shown and never run. Note input is validated for length.
- **Retest:** the exploit test fails on `v0-as-shipped` and passes on `main`.
- **In plain words:** a note could contain a small program, and the page would run it. Notes are now only ever text.

### F09. Errors return stack traces and SQL (Low)

- **Why Low:** it gives an attacker a map of the code and the database, but opens nothing by itself.
- **Where (v0):** `lib/http.ts:10`, error responses include `stack`, the database message and the statement.
- **Reproduce:** `tests/exploits/f09-error-leak.test.ts` triggers a database failure and a parse failure and reads the responses.
- **Fix:** commit `13b2c6b`. Callers get a short message and a correlation id, in the body and in an `x-correlation-id` header. The full detail goes to the server log under the same id.
- **Retest:** the exploit test fails on `v0-as-shipped` and passes on `main`. It checks that the correlation id is present as well as that the leak is gone.
- **In plain words:** when something broke, the app explained itself in detail to whoever was watching. Now the customer sees a short message, and your team finds the detail in the logs by id.

### F10. No security headers (Low)

- **Why Low:** these are second layers of defence. They limit the damage if another flaw exists.
- **Where (v0):** `next.config.ts:4`, no headers configured.
- **Reproduce:** `tests/exploits/f10-security-headers.test.ts` reads the response headers on a page and an API route.
- **Fix:** commit `ad6a101`. A content security policy, HSTS, `X-Content-Type-Options`, a referrer policy, frame blocking and a permissions policy. The `X-Powered-By` header is off.
- **Retest:** the exploit test fails on `v0-as-shipped` and passes on `main`. The ZAP baseline scan shows none of the missing-header alerts on `main`.
- **In plain words:** the browser had no instructions about what the site is allowed to do. It does now.

## Scanner results on main

| Tool | Result |
|---|---|
| Semgrep (TypeScript and Next.js rule sets plus four rules written for this app) | no findings at ERROR severity. The app's own rules flag the old code. |
| gitleaks over the full history | no leaks found |
| osv-scanner on `package-lock.json` | 518 packages scanned, none rated high or critical |
| OWASP ZAP baseline against the running app | 0 failures. The warnings are listed below, and the exact counts are in the CI log. |

## Not fixed in this sample

These came out of the scans and the review. I left them open on purpose so the report stays honest about what a first pass leaves behind.

- **Inline scripts and styles allowed by the content security policy.** Next.js adds small inline scripts, so the policy permits them for now. ZAP reports this at medium. The next step is a nonce-based policy.
- **Cross-origin isolation headers** (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, `Cross-Origin-Resource-Policy`) are not set. ZAP reports them at low.
- **No anti-CSRF token on the sign-in and sign-up forms.** Next.js server actions check the request origin, which covers the usual case. A token would add a second layer.
- **No rate limiting** on sign-in, checkout or import.
- **Sessions are not refreshed in the browser,** so a long-lived tab can lose its session after an hour.
- **Row level security on `product_notes` has no delete or update policy.** That is intended here, and worth revisiting if notes become editable.

## 30-day cleanup plan

**Week 1. Close the doors.** Confirm F01, F02, F03, F05 and F07 on the live system before anything else. Rotate every key that has ever been in a bundle, a log or a chat. Turn on secret scanning and push protection.

**Week 2. Money and tenants.** Add monitoring on webhook failures and duplicate event ids. Review every table for row level security and add a pgTAP test for each policy. Check that every route that takes an id also checks ownership.

**Week 3. Browser and errors.** Move to a nonce-based content security policy. Add the cross-origin headers. Add rate limiting to sign-in, checkout and import. Ship the correlation id to wherever your team reads logs.

**Week 4. Keep it fixed.** Run the exploit suite on every pull request. Add Semgrep rules for the patterns that bit you. Write down who reviews a change that touches auth, payments or the database, and what they check.

## What this review did not cover

Load testing, mobile clients, the hosting platform's own configuration, third-party services beyond Stripe in test mode, and social engineering. The data is synthetic and the app has no real customers, so nothing here says anything about a live system. The ten flaws were seeded on purpose, so the count is a feature of the sample and not a measurement of how many flaws an app like this has.
