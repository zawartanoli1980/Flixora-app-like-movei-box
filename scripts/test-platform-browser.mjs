import { chromium } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { openStore, createOwner } from "../server/platform/store.js";
import { createPlatformApp } from "../server/platform/app.js";
import { startWorker } from "../server/platform/worker.js";
// All accounts and media below live in an isolated temporary database. No app seed data.
const root = mkdtempSync(join(tmpdir(), "flixora-browser-"));
const store = openStore(root);
const password = randomBytes(24).toString("hex");
createOwner(store.db, "owner@example.test", password);
const server = createPlatformApp({ ...store, secureCookies: false }).listen(
  0,
  "127.0.0.1",
);
await new Promise((r) => server.once("listening", r));
const stop = startWorker(store);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("Browser error:", e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") console.error(m.text());
  });
  await page.route("**/api/platform/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url:
        "http://127.0.0.1:" + server.address().port + url.pathname + url.search,
    });
    await route.fulfill({ response });
  });
  await page.goto(process.env.WEB_TEST_URL || "http://127.0.0.1:5173/", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("heading", { name: "The library is taking shape" })
    .waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("alert").waitFor();
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Administration", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Your platform, at a glance." })
    .waitFor();
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.getByText("Create content draft", { exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Browser validation fixture");
  await page.getByLabel("Language", { exact: true }).fill("en");
  await page
    .getByLabel("Description", { exact: true })
    .fill(
      "Isolated browser-test fixture; never published in the real database.",
    );
  await page
    .getByLabel("Authorization / license reference")
    .fill("Automated test fixture authorization");
  await page.getByLabel("Rights start").fill("2020-01-01T00:00");
  await page.getByLabel("Rights end").fill("2099-01-01T00:00");
  await page.getByLabel("I have rights to distribute this content.").check();
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await page
    .getByRole("heading", { name: "Browser validation fixture", exact: true })
    .waitFor();
  const video = join(root, "fixture.mp4");
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=32x32:d=1",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    video,
  ]);
  await page.locator("input[type=file]").setInputFiles(video);
  await page
    .getByRole("button", { name: "Publish", exact: true })
    .waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Archive", exact: true }).waitFor();
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page
    .getByRole("heading", { name: "Browser validation fixture", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Watch", exact: true }).click();
  await page.locator("video").waitFor();
  await page.waitForFunction(
    () => document.querySelector("video")?.readyState >= 2,
  );
  assert.equal(await page.locator("video").evaluate((v) => v.error), null);
  await page.getByRole("button", { name: "Close player" }).click();
  await page.getByRole("button", { name: "Anime", exact: true }).click();
  await page
    .getByRole("heading", { name: "The anime is taking shape" })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({
      path: join(process.env.SCREENSHOT_DIR, "flixora-mobile.png"),
      fullPage: true,
    });
  await page
    .getByRole("button", { name: "Administration", exact: true })
    .click();
  await page.getByRole("button", { name: "Demo catalog", exact: true }).click();
  await page
    .getByRole("button", { name: "Add 240 demo previews", exact: true })
    .click();
  await page.getByRole("button", { name: "Hide demos", exact: true }).waitFor();
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page.getByRole("button", { name: "All content", exact: true }).click();
  await page
    .getByRole("button", { name: "View demo", exact: true })
    .first()
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "View demo", exact: true }).count(),
    240,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "My list unavailable for demo previews" })
      .first()
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Drama series", exact: true }).click();
  await page
    .getByRole("button", { name: "View demo", exact: true })
    .first()
    .click();
  const preview = page.getByRole("dialog", { name: "Demo metadata preview" });
  await preview.waitFor();
  assert.equal(await preview.locator("video").count(), 0);
  assert.equal(
    await preview.getByText("Demo · No video", { exact: true }).count(),
    6,
  );
  await page.getByRole("button", { name: "Close demo preview" }).click();
  await page.getByRole("button", { name: "All content", exact: true }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  if (process.env.SCREENSHOT_DIR) {
    await page.screenshot({
      path: join(process.env.SCREENSHOT_DIR, "flixora-demo-mobile.png"),
    });
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.screenshot({
      path: join(process.env.SCREENSHOT_DIR, "flixora-demo-desktop.png"),
    });
  }
  await page
    .getByRole("button", { name: "Administration", exact: true })
    .click();
  await page.getByRole("button", { name: "Demo catalog", exact: true }).click();
  await page.getByRole("button", { name: "Hide demos", exact: true }).click();
  await page.getByRole("button", { name: "Show demos", exact: true }).waitFor();
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page
    .getByRole("heading", { name: "Browser validation fixture", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "View demo", exact: true }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser passed: owner login → draft → real upload → validation → publish → video decode; category isolation, owner demo controls, 240 labeled previews, sample episodes and mobile overflow.",
  );
} finally {
  await browser.close();
  stop();
  await new Promise((r) => server.close(r));
  store.db.close();
  rmSync(root, { recursive: true, force: true });
}
