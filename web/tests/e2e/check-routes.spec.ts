import { test, expect } from "@playwright/test";

const ROUTES = [
  "/",
  "/campaigns",
  "/trade",
  "/trade/new",
  "/leaderboard",
  "/wallet",
  "/wallet/withdraw",
  "/prizes",
  "/settings",
  "/login",
  "/phone-binding",
  "/support",
  "/support/new",
  "/exchange",
  "/exchange/new",
  "/shipping",
  "/shipping/new",
  "/dev",
];

for (const route of ROUTES) {
  test(`${route} should render without 404`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);

    // Check that the Next.js default 404 error page is NOT visually displayed
    const notFoundHeading = page.locator("h1.next-error-h1");
    await expect(notFoundHeading).toHaveCount(0);
  });
}

// Test clicking navigation links from homepage
test("homepage nav links should work", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const navLinks = [
    { href: "/trade", label: "Market" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/prizes", label: "My Prizes" },
    { href: "/wallet", label: "Wallet" },
  ];

  for (const { href, label } of navLinks) {
    await page.goto("/", { waitUntil: "networkidle" });
    const link = page.locator(`a[href="${href}"]`).first();
    if (await link.isVisible()) {
      await link.click();
      await page.waitForURL(`**${href}`, { timeout: 5000 });

      // Verify no 404 error page shown
      const notFoundHeading = page.locator("h1.next-error-h1");
      await expect(notFoundHeading, `Clicking ${label} (${href}) shows 404 page`).toHaveCount(0);
    }
  }
});
