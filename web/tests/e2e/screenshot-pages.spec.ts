import { test } from "@playwright/test";
test("campaign detail ticket grid", async ({ page }) => {
  await page.goto("http://localhost:3001/campaigns/00000000-0000-0000-0000-000000000101", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/tmp/ss_ticket_grid.png", fullPage: true });
});
test("campaign detail mobile", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3001/campaigns/00000000-0000-0000-0000-000000000101", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/tmp/ss_ticket_grid_mobile.png", fullPage: true });
  await ctx.close();
});
