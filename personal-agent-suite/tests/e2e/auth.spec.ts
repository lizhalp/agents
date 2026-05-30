import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test("anonymous users are redirected to the sign-in screen", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/auth\/signin$/);
  await expect(page.getByLabel("Email or username")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "GitHub" })).toBeVisible();
});

test("configured owner can sign in and log out", async ({ page }) => {
  await page.goto("/auth/signin");
  await page.getByLabel("Email or username").fill("akadmin");
  await page.getByLabel("Password").fill("change-me-local-password");
  await page.getByRole("button", { name: "Sign in to your suite" }).click();

  await expect(page).toHaveURL("https://localhost/");
  await expect(page.getByText("Signed in as")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth\/signin$/);
});

test("bad local credentials are rejected", async ({ page }) => {
  await page.goto("/auth/signin");
  await page.getByLabel("Email or username").fill("akadmin");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in to your suite" }).click();

  await expect(page.getByText("Invalid email, username, or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/signin$/);
});

test("anonymous API access is rejected", async ({ request }) => {
  const response = await request.get("http://localhost/api/status");
  expect(response.status()).toBe(401);
});
