// Browser smoke test against the production build: `npm run build && npm run test:e2e`.
// Uses the installed Chrome (PLAYWRIGHT_CHANNEL to change) and talks to localhost without any proxy.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.E2E_PORT || 3205);
const base = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const nz2027 = JSON.parse(readFileSync(path.join(root, "data/nz2027.json"), "utf8"));
const firstTitle = nz2027.days[0].title;

const server = process.env.E2E_BASE_URL ? null : spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(port)], { cwd: root, stdio: "ignore" });
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
  console.log(`${condition ? "✓" : "✗"} ${message}`);
};

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", args: ["--no-proxy-server"] });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

  for (const route of ["/", "/nz2027", "/nz2027/dining", "/nz2027/prep", "/nz2027/costs", "/au2026", "/au2026/days"]) {
    const response = await page.goto(`${base}${route}`);
    const text = await page.locator("body").innerText();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(response.ok(), `${route} opens`);
    check(!wide, `${route} has no sideways scroll on a phone`);
    check(!/(确认号|订位号|订单号)\s*[A-Z0-9]{4,}/.test(text), `${route} shows no booking numbers`);
  }

  await page.goto(`${base}/`);
  check(await page.locator(".share-trip-card").count() === 2, "home lists both trips");

  await page.goto(`${base}/au2026`);
  check(await page.locator(".share-toc a").count() >= 5, "guide has a contents list");
  check(await page.locator(".share-prose h2[id]").count() >= 5, "guide headings have anchors");
  await page.goto(`${base}/au2026/days`);
  check(await page.locator(".nz-day").count() === 17, "2026 day-by-day lists 17 days");

  // Edit, reload, export, reset, import.
  await page.goto(`${base}/nz2027`);
  await page.getByRole("button", { name: "开始改" }).click();
  await page.locator("#day-d1 .nz-day-head").click();
  await page.getByLabel("这天的标题").first().fill("我自己的第一天");
  await page.locator("#day-d1").getByRole("button", { name: "在下面加一步" }).first().click();
  await page.locator("#day-d1 .share-edit-block").nth(1).getByLabel("地点").fill("多加的一站");
  await page.getByRole("button", { name: "改好了" }).click();
  await page.reload();
  await page.locator("#day-d1 .nz-day-head").click();
  check(await page.locator("#day-d1 .nz-day-cover strong").innerText() === "我自己的第一天", "edited title is still there after reload");
  check(await page.locator("#day-d1 .nz-timeline").innerText().then((text) => text.includes("多加的一站")), "added step is still there after reload");
  check(await page.locator(".share-tools p").first().innerText().then((text) => text.includes("改过的版本")), "tools say this is your own version");

  const [markdown] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "导出文字版" }).click()]);
  const markdownText = readFileSync(await markdown.path(), "utf8");
  check(markdownText.includes("我自己的第一天") && markdownText.includes("多加的一站"), "text export has the edits");
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "导出文件" }).click()]);
  const exportedPath = await file.path();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "恢复原版" }).click();
  check(await page.locator("#day-d1 .nz-day-cover strong").innerText() === firstTitle, "restore brings back the original");

  await page.locator('input[type="file"]').setInputFiles(exportedPath);
  await page.waitForTimeout(300);
  check(await page.locator("#day-d1 .nz-day-cover strong").innerText() === "我自己的第一天", "importing the file brings the edits back");

  await page.goto(`${base}/nz2027/dining`);
  check(await page.locator("#dining-d1").innerText().then((text) => text.length > 0), "dining page follows the edited copy");

  // Checklist ticks stay on this device.
  await page.goto(`${base}/nz2027/prep`);
  await page.locator(".nz-check label").first().click();
  await page.reload();
  check(await page.locator(".nz-check input").first().isChecked(), "checklist tick is kept after reload");

  check(errors.length === 0, `no browser errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
} catch (error) {
  failures.push(error.message);
  console.error(error);
} finally {
  await browser?.close();
  server?.kill();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll smoke checks passed.");

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not start at ${base}`);
}
