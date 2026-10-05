import { expect, test } from "@playwright/test";
import Stripe from "stripe";

// stripe-mock answers API calls but never sends webhooks, so the test plays Stripe's part:
// it signs a checkout.session.completed event with the local secret and posts it to the app.
test("sign up, add to cart, check out with stripe-mock, see the paid order", async ({ page, baseURL }) => {
  const email = `smoke-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.fill('input[name="orgName"]', "Smoke Test Foods");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "smoke-password-1");
  await page.click('button:has-text("Create account")');
  await page.waitForURL("**/products");

  await page.locator('button:has-text("Add to cart")').first().click();
  await page.goto("/cart");
  await expect(page.locator("tbody tr")).toHaveCount(1);

  // Stripe's hosted page is not part of this sample, so keep the browser on our side.
  await page.route((url) => url.hostname !== new URL(baseURL!).hostname, (route) => route.fulfill({ status: 200, body: "stripe checkout stub" }));
  // Read the checkout response before the page follows its redirect.
  let checkout: { status: number; body: { orderId: string; url: string } } | undefined;
  await page.route("**/api/checkout", async (route) => {
    const res = await route.fetch();
    checkout = { status: res.status(), body: await res.json() };
    await route.fulfill({ response: res });
  });
  await page.click('button:has-text("Check out")');
  await expect.poll(() => checkout?.status).toBe(200);
  const { orderId, url } = checkout!.body;
  expect(orderId).toBeTruthy();
  expect(url).toMatch(/^https:\/\//);

  const stripe = new Stripe("sk_test_123");
  const payload = JSON.stringify({
    id: `evt_smoke_${Date.now()}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_smoke", object: "checkout.session", payment_status: "paid", metadata: { order_id: orderId } } },
  });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
  const hook = await fetch(`${baseURL}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": signature, "content-type": "application/json" }, body: payload });
  expect(hook.status).toBe(200);

  await page.goto("/orders");
  const row = page.locator('[data-testid="order-row"]');
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-status", "paid");
  await expect(row.locator("a")).toHaveText(/^INV-/);
});
