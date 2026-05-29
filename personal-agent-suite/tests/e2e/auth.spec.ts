import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test("anonymous users are redirected to the sign-in screen", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/auth\/signin$/);
  await expect(page.getByRole("tab", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Register" })).toBeVisible();
  await expect(page.getByLabel("Email or username")).toBeVisible();
  await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "GitHub" })).toBeVisible();
});

test("authenticated users can reach the dashboard and log out", async ({ page }) => {
  await page.goto("/auth/signin");
  await page.getByLabel("Email or username").fill("akadmin");
  await page.getByLabel("Password").fill("authentik-admin-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("https://localhost/");
  await expect(page.getByText("Signed in as")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth\/signin$/);
});

test("users can register from the custom sign-in page", async ({ page }) => {
  const suffix = Date.now();
  const username = `operator.${suffix}`;
  const email = `operator.${suffix}@example.com`;
  const password = `operator-pass-${suffix}`;

  await page.goto("/auth/signin");
  await page.getByRole("tab", { name: "Register" }).click();

  await page.getByLabel("Full name").fill("Operator Test");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create your suite account" }).click();

  await expect(page).toHaveURL("https://localhost/");
  await expect(page.getByText("Signed in as")).toBeVisible();
});

test("users can sign back in manually after registering and logging out", async ({ page }) => {
  const suffix = Date.now();
  const username = `returning.${suffix}`;
  const email = `returning.${suffix}@example.com`;
  const password = `returning-pass-${suffix}`;

  await page.goto("/auth/signin");
  await page.getByRole("tab", { name: "Register" }).click();

  await page.getByLabel("Full name").fill("Returning User");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create your suite account" }).click();

  await expect(page).toHaveURL("https://localhost/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth\/signin$/);

  await page.getByLabel("Email or username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in to your suite" }).click();

  await expect(page).toHaveURL("https://localhost/");
  await expect(page.getByText("Signed in as")).toBeVisible();
});

test("duplicate registration errors appear on the relevant field", async ({ page }) => {
  const suffix = Date.now();
  const username = `duplicate.${suffix}`;
  const firstEmail = `duplicate.${suffix}@example.com`;
  const secondEmail = `second.${suffix}@example.com`;
  const password = `duplicate-pass-${suffix}`;

  await page.goto("/auth/signin");
  await page.getByRole("tab", { name: "Register" }).click();

  await page.getByLabel("Full name").fill("Duplicate User");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(firstEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create your suite account" }).click();

  await expect(page).toHaveURL("https://localhost/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth\/signin$/);

  await page.getByRole("tab", { name: "Register" }).click();
  await page.getByLabel("Full name").fill("Duplicate User");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(secondEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create your suite account" }).click();

  await expect(page.getByText("That username is already taken.")).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveAttribute("aria-invalid", "true");
});

test("anonymous API access is rejected", async ({ request }) => {
  const response = await request.get("http://localhost/api/status");
  expect(response.status()).toBe(401);
});
