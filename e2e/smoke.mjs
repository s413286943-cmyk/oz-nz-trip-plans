// Browser smoke test against the production build: `npm run build && npm run test:e2e`.
// Uses the installed Chrome (PLAYWRIGHT_CHANNEL to change) and talks to localhost without any proxy.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.E2E_PORT || 3205);
const base = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const nz = JSON.parse(readFileSync(path.join(root, "data/nz.json"), "utf8"));
const library = JSON.parse(readFileSync(path.join(root, "data/places.json"), "utf8"));
const firstTitle = nz.days[0].title;

// A server already on this port would be tested instead of this build: refuse to start.
if (!process.env.E2E_BASE_URL && await fetch(base).then(() => true, () => false)) {
  console.error(`Something is already serving ${base}; stop it or set E2E_PORT.`);
  process.exit(1);
}
const server = process.env.E2E_BASE_URL ? null : spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(port)], { cwd: root, stdio: "ignore" });
let serverExit = null;
server?.on("exit", (code) => { serverExit = code; });
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
  // What the policy refused is read from the page's own violation reports, which name what was blocked
  // and which script asked for it. Expected (on the live site: the host's statistics scripts): something
  // from another site, or something a script from another site tried. Anything else, an inline script
  // or one of the site's own files included, is an error; on the live site too.
  const refused = new Set();
  const ownOrigin = new URL(base).origin;
  const originOf = (url) => {
    try {
      return /^https?:/.test(url) ? new URL(url).origin : "";
    } catch {
      return "";
    }
  };
  await context.exposeBinding("__e2eViolation", (_source, report) => {
    const blocked = originOf(report.blocked);
    const from = originOf(report.source);
    if (blocked && blocked !== ownOrigin) refused.add(blocked);
    else if (from && from !== ownOrigin) refused.add(from);
    else errors.push(`policy refused ${report.blocked || "something"} (${report.directive}) from ${report.source || "the page"}`);
  });
  await context.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__e2eViolation?.({ blocked: event.blockedURI, source: event.sourceFile, directive: event.effectiveDirective || event.violatedDirective });
    });
  });
  page.on("console", (message) => {
    if (message.type() !== "error" || /Content Security Policy/i.test(message.text())) return;
    errors.push(message.text());
  });
  // The pages talk to their own address and, for forecasts, Open-Meteo; nothing else.
  const outside = new Set();
  // Only requests that went out count: one the policy blocked fails before it leaves the browser.
  context.on("requestfinished", (request) => {
    const { origin, protocol } = new URL(request.url());
    if (/^https?:$/.test(protocol) && origin !== new URL(base).origin && origin !== "https://api.open-meteo.com") outside.add(origin);
  });

  const home = await fetch(`${base}/`);
  const policy = home.headers.get("content-security-policy") || "";
  check(/frame-ancestors/.test(policy) && /connect-src 'self' https:\/\/api\.open-meteo\.com(;|$)/.test(policy), "pages send a content security policy");
  const homeHtml = await home.text();
  check(homeHtml.includes('property="og:image"') && homeHtml.includes("/nz/card.jpg") && homeHtml.includes('rel="apple-touch-icon"'), "home has a link preview card and icons");
  const probe = await context.newPage();
  const missing = await probe.goto(`${base}/no-such-page`);
  check(missing.status() === 404 && await probe.locator("h1").innerText() === "没有这一页" && await probe.getByRole("link", { name: "回首页" }).count() === 1, "a missing page says so in Chinese and leads back");
  await probe.close();

  // Against the live site, it must be serving this export, not an older one.
  const nzHtml = await (await fetch(`${base}/nz`)).text();
  check(nzHtml.includes(nz.version), `/nz serves data version ${nz.version}`);

  const linked = new Set();
  for (const route of ["/", "/plan", "/method", "/nz", "/nz/dining", "/nz/prep", "/nz/costs", "/au2026", "/au2026/guide", "/au2026/days", "/mine", "/mine/budget", "/mine/prep"]) {
    const response = await page.goto(`${base}${route}`);
    const text = await page.locator("body").innerText();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(response.ok(), `${route} opens`);
    check(!wide, `${route} has no sideways scroll on a phone`);
    check(!/(确认号|订位号|订单号)\s*[A-Z0-9]{4,}/.test(text), `${route} shows no booking numbers`);
    if (route.startsWith("/nz")) check(!/\b20[2-9]\d\b|\b\d{1,2}\/\d{1,2}\b|\d+\s*月\s*\d+\s*日/.test(text), `${route} is written by day number`);
    // Pictures the browser has finished with must have loaded (a refused or broken one ends with no pixels);
    // the ones above the fold are waited for.
    const settled = await page.waitForFunction(() => [...document.images].filter((img) => img.loading !== "lazy").every((img) => img.complete), null, { timeout: 10000 }).then(() => true, () => false);
    const pending = settled ? [] : await page.evaluate(() => [...document.images].filter((img) => img.loading !== "lazy" && !img.complete).map((img) => img.getAttribute("src")));
    check(pending.length === 0, `${route} pictures finish loading within 10 seconds${pending.length ? `: ${pending.slice(0, 2).join(", ")}` : ""}`);
    const blank = await page.evaluate(() => [...document.images].filter((img) => img.complete && img.currentSrc && img.naturalWidth === 0).map((img) => img.getAttribute("src")));
    check(blank.length === 0, `${route} pictures load in the page${blank.length ? `: ${blank.slice(0, 2).join(", ")}` : ""}`);
    for (const url of await page.evaluate(() => [...document.querySelectorAll("img[src], a[href^='/']")].map((node) => node.getAttribute("src") || node.getAttribute("href")))) {
      linked.add(url.split("#")[0] || "/");
    }
  }
  const broken = [];
  for (const url of linked) {
    const response = await fetch(new URL(url, base));
    if (!response.ok) broken.push(`${url} ${response.status}`);
  }
  check(linked.size > 40 && broken.length === 0, `every picture and page the pages point to opens (${linked.size})${broken.length ? `: ${broken.slice(0, 3).join(", ")}` : ""}`);

  await page.goto(`${base}/`);
  check(await page.locator(".share-trip-card").count() === 2, "home lists both trips");

  await page.goto(`${base}/au2026`);
  check(await page.locator(".route-day-card").count() === 17, "2026 atlas shows all 17 days");
  check(await page.locator(".share-retro-stats article").count() === 4, "2026 page opens with the trip summary");
  check(await page.locator(".share-stage-retro").count() === 3, "every 2026 stage has its notes");
  check(await page.locator("#d9 .share-day-retro").innerText().then((text) => text.includes("挡风玻璃")), "D9 carries the windscreen story");
  check(await page.locator("#d14 h3").innerText().then((text) => text.includes("南海岸")), "8/11 is the south coast drive");
  check(await page.locator("#d13 h3").innerText().then((text) => text.includes("Taronga")), "8/10 is Taronga, shopping and Porteño");
  check(await page.locator("#d3 .share-retro-nav").count() === 1, "driving days link their Google Maps route");
  check(!/实际|原计划|走完回来|路书|Route atlas/.test(await page.locator("body").innerText()), "2026 page reads as shared, not as notes against a plan");

  await page.goto(`${base}/au2026/guide`);
  check(await page.locator(".share-toc a").count() >= 5, "guide has a contents list");
  check(!/走完回来|原计划/.test(await page.locator(".nz-page-head").innerText()), "guide intro reads as shared, not as notes against a plan");
  check(await page.locator(".share-prose h2[id]").count() >= 5, "guide headings have anchors");
  await page.goto(`${base}/au2026/days`);
  check(await page.locator(".nz-day").count() === 17, "2026 day-by-day lists 17 days");
  await page.locator("#day-d3 .nz-day-head").click();
  const readable = await page.evaluate(() => {
    const rgb = (value) => (value.match(/[\d.]+/g) || []).map(Number);
    const luminance = ([r, g, b]) => [r, g, b].map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    const behind = (element) => {
      for (let node = element; node; node = node.parentElement) {
        const color = rgb(getComputedStyle(node).backgroundColor);
        if (color.length === 3 || color[3] > 0.5) return color;
      }
      return [255, 255, 255];
    };
    const ratio = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return 0;
      const [a, b] = [luminance(rgb(getComputedStyle(element).color)), luminance(behind(element))].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    };
    const cover = rgb(getComputedStyle(document.querySelector("#day-d3 .nz-day-cover strong")).color);
    return { timeline: ratio("#day-d3 .nz-timeline p"), coverLight: luminance(cover) > 0.6 };
  });
  check(readable.timeline >= 4.5, `2026 day steps are readable on the light page (${readable.timeline.toFixed(2)}:1)`);
  check(readable.coverLight, "2026 day titles stay light on their dark photo");

  await page.goto(`${base}/nz`);
  check(await page.locator("#day-d1 .nz-day-cover small").innerText() === "DAY 1", "/nz days show the day number");
  check(await page.locator(".nz-cities small").first().innerText().then((text) => text.startsWith("D1")), "where-we-stay counts days");
  check(await page.locator(".nz-cities img").first().getAttribute("src").then((src) => /city-sydney/.test(src || "")), "where-we-stay cards use the city pictures");
  check(await page.locator(".share-map-pin").count() === 7, "/nz route map shows every stop");
  await page.locator(".share-map-pin", { hasText: "Te Anau" }).click();
  check(await page.locator(".share-stopcard small").innerText() === "第 10 到 11 天，住 2 晚", "tapping a stop shows its days");
  check(await page.locator(".share-ridge").count() === 1, "/nz shows how long each day's drive is");
  check(await page.locator(".share-lightrow, .share-road").count() === 0, "/nz has no light rows or weather: those belong to a dated plan");

  // Edit, reload, export, reset, import.
  await page.goto(`${base}/nz`);
  await page.getByRole("button", { name: "开始改" }).click();
  await page.locator("#day-d1 .nz-day-head").click();
  await page.getByLabel("这天的标题").first().fill("改过的第一天");
  await page.locator("#day-d1").getByRole("button", { name: "在下面加一步" }).first().click();
  await page.locator("#day-d1 .share-edit-block").nth(1).getByLabel("地点").fill("多加的一站");
  await page.getByRole("button", { name: "改好了" }).click();
  await page.reload();
  await page.locator("#day-d1 .nz-day-head").click();
  check(await page.locator("#day-d1 .nz-day-cover strong").innerText() === "改过的第一天", "edited title is still there after reload");
  check(await page.locator("#day-d1 .nz-timeline").innerText().then((text) => text.includes("多加的一站")), "added step is still there after reload");
  check(await page.locator(".share-tools p").first().innerText().then((text) => text.includes("改过的版本")), "tools say this is your own version");

  const [markdown] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "导出文字版" }).click()]);
  const markdownText = readFileSync(await markdown.path(), "utf8");
  check(markdownText.includes("改过的第一天") && markdownText.includes("多加的一站"), "text export has the edits");
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "存成文件" }).click()]);
  const exportedPath = await file.path();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "恢复成参考路线" }).click();
  check(await page.locator("#day-d1 .nz-day-cover strong").innerText() === firstTitle, "restore brings back the original");

  await page.locator('input[type="file"]').setInputFiles(exportedPath);
  await page.waitForTimeout(300);
  check(await page.locator("#day-d1 .nz-day-cover strong").innerText() === "改过的第一天", "importing the file brings the edits back");

  // An edit on the 2026 edit page shows on the 2026 atlas page.
  await page.goto(`${base}/au2026/days`);
  await page.getByRole("button", { name: "开始改" }).click();
  await page.locator("#day-d3 .nz-day-head").click();
  await page.getByLabel("这天的标题").first().fill("改过的大洋路第一天");
  await page.getByRole("button", { name: "改好了" }).click();
  await page.goto(`${base}/au2026`);
  check(await page.locator("#d3 h3").innerText() === "改过的大洋路第一天", "2026 atlas shows the visitor's own edits");

  // A day added on the 2026 edit page has no date of its own: the atlas still opens and shows it.
  await page.goto(`${base}/au2026/days`);
  await page.getByRole("button", { name: "开始改" }).click();
  await page.locator("#day-d5 .nz-day-head").click();
  await page.locator("#day-d5").getByRole("button", { name: "在后面加一天" }).click();
  check(await page.locator(".nz-day").count() === 18, "a day can be added on the 2026 edit page");
  await page.getByRole("button", { name: "改好了" }).click();
  await page.goto(`${base}/au2026`);
  check(await page.locator(".route-day-card").count() === 18, "2026 atlas shows the added day");
  check(await page.locator(".route-day-card .day-cover strong", { hasText: "日期待定" }).count() === 1, "the added day reads 日期待定");

  await page.goto(`${base}/nz/dining`);
  check(await page.locator("#dining-d1").innerText().then((text) => text.length > 0), "dining page follows the edited copy");

  // Checklist ticks stay on this device.
  await page.goto(`${base}/nz/prep`);
  await page.locator(".nz-check label").first().click();
  await page.reload();
  check(await page.locator(".nz-check input").first().isChecked(), "checklist tick is kept after reload");

  // Your own route: load ours, change it, lay out the days, then budget, bookings, own item, file, delete, open again.
  await page.goto(`${base}/`);
  await page.getByRole("link", { name: "开始排路线" }).click();
  await page.getByRole("button", { name: /载入新西兰参考路线/ }).click();
  check(await page.locator(".route-stop").count() === 7, "our New Zealand route loads as 7 stops");
  check(await page.locator(".route-map .share-sheet-tabs button").count() === 2, "Sydney plus New Zealand: an Australia map and a New Zealand map");
  check(await page.locator(".route-map .share-sheet-tabs button.is-active").innerText() === "新西兰南岛", "the builder shows the map of the latest country");
  await page.locator(".route-stop").first().getByRole("button", { name: "删掉" }).click();
  check(await page.locator(".route-stop").count() === 6, "a stop can be removed");
  check(await page.locator(".route-map .share-sheet-tabs").count() === 0 && await page.locator(".route-map .share-map-pin").count() === 6, "without Sydney only the New Zealand map, with every stop");
  const twizel = page.locator(".route-stop", { hasText: "Twizel" });
  await twizel.getByRole("button", { name: "住几晚减一" }).click();
  const twizelNotes = (await twizel.locator(".route-note").allInnerTexts()).join("\n");
  check(twizelNotes.includes("看天气"), "two nights at Twizel asks for a spare weather day");
  check(twizelNotes.includes("长途"), "the long drive into Twizel is flagged");
  await page.getByRole("button", { name: "＋ 从全部地点里挑" }).click();
  await page.getByLabel("地方的名字").fill("Dunedin");
  await page.getByRole("button", { name: "＋ 加上" }).click();
  await page.locator(".route-stop").nth(6).getByRole("button", { name: "往前" }).click();
  const dunedin = page.locator(".route-stop").nth(5);
  check(await dunedin.locator(".route-stop-copy strong").innerText() === "Dunedin", "a stop can be moved up");
  check(await dunedin.locator(".route-hop").innerText().then((text) => text.includes("没走过")), "a road we never took says so");
  check(await page.locator(".route-stop").nth(1).locator(".route-hop").innerText().then((text) => text.includes("参考路线里开车")), "a road we drove shows its drive time");
  await page.locator('.plan-field input[type="date"]').fill("2030-03-04");
  await page.getByRole("button", { name: "大人加一" }).click();
  await page.getByText("松一点").click();
  await page.reload();
  check(await page.locator(".route-stop").count() === 7, "the route survives a reload");
  check(await page.locator(".plan-choices strong").first().evaluate((node) => getComputedStyle(node).color !== "rgb(86, 105, 102)"), "pace names are not dimmed by a borrowed label style");
  await page.getByRole("button", { name: "清空路线，重新开始" }).click();
  check(await page.locator(".route-stop").count() === 0, "the route can be cleared");
  await page.locator(".route-undo").getByRole("button", { name: "撤销" }).click();
  check(await page.locator(".route-stop").count() === 7, "clearing the route can be undone");
  await page.locator(".route-stop").first().getByRole("button", { name: "删掉" }).click();
  await page.locator(".route-undo").getByRole("button", { name: "撤销" }).click();
  check(await page.locator(".route-stop").count() === 7, "removing a stop can be undone");
  await page.getByRole("button", { name: "按这条路线排出每一天" }).click();
  await page.waitForURL(/\/mine(\?|$)/);
  await page.locator(".share-planbar").waitFor();
  check(await page.locator(".share-planbar-line").innerText().then((text) => text.includes("15 天") && text.includes("3 个大人")), "plan bar shows days and people");
  check(await page.locator(".nz-day").count() === 15, "every night of the route has a day");
  check(await page.locator(".nz-day-cover strong").first().innerText().then((text) => text.includes("基督城")), "the plan starts in Christchurch");
  check(await page.locator(".nz-stage h2", { hasText: "Dunedin" }).count() === 1, "the visitor's own place has its days");
  check(await page.locator(".nz-day-cover small").first().innerText().then((text) => text.includes("3月4日")), "days carry the visitor's dates");
  check(await page.getByRole("button", { name: "改好了" }).count() === 1, "the plan opens in the editor");
  check(await page.locator(".share-lightrow").count() === 15, "every day of the plan has its light");
  check(await page.locator(".share-lightrow").first().innerText().then((text) => /日落 \d{2}:\d{2}/.test(text) && /约 \d+–\d+°/.test(text)), "light rows give the sunset and the usual weather");
  check(await page.locator(".share-map-pin").count() >= 6, "the plan's route is on the map");
  check(await page.locator(".share-road").count() === 0, "no on-the-road view before the trip");
  const milford = page.locator(".nz-day", { hasText: "Milford Sound大巴与游船日" });
  await milford.locator(".nz-day-head").click();
  await milford.getByRole("button", { name: "在后面加一天" }).click();
  check(await page.locator(".nz-day").count() === 16, "a day can be added");
  const added = page.locator(".nz-day", { hasText: "新的一天" });
  await added.locator(".nz-day-head").click();
  page.once("dialog", (dialog) => dialog.accept());
  await added.getByRole("button", { name: "删掉这一天" }).click();
  check(await page.locator(".nz-day").count() === 15, "a day can be removed");
  await page.getByRole("button", { name: "改好了" }).click();

  await page.goto(`${base}/mine?preview=road`);
  await page.locator(".share-road").waitFor();
  check(await page.locator(".share-road-clock b").innerText() === "10:00", "the on-the-road preview shows the local clock");
  check(await page.locator(".share-road").innerText().then((text) => text.includes("今晚住") && text.includes("明天第一件事") && /日落 \d{2}:\d{2}/.test(text)), "on the road: tonight, tomorrow and the sun");

  await page.goto(`${base}/mine/budget`);
  check(await page.locator(".share-budget h1").innerText() === "预算", "budget page opens");
  check(await page.locator(".share-budget-lines li").first().innerText().then((text) => text.includes("¥34,440")), "flights are worked out for three people");
  await page.locator(".share-budget-lines li").filter({ hasText: "吃喝" }).getByRole("button", { name: "改金额" }).click();
  await page.locator(".share-budget-edit input").first().fill("9000");
  await page.getByRole("button", { name: "存下" }).click();
  await page.reload();
  check(await page.locator(".share-budget-lines li.is-edited").innerText().then((text) => text.includes("¥9,000")), "a budget line the visitor typed in stays");

  await page.goto(`${base}/mine/prep`);
  check(await page.locator(".nz-check-group", { hasText: "什么时候订什么" }).innerText().then((text) => text.includes("Milford") && !text.includes("Gidley")), "bookings follow the visitor's route");
  check(await page.locator(".nz-check-group", { hasText: "出发前要办的" }).innerText().then((text) => text.includes("NZeTA")), "getting-ready items follow the countries");
  check(await page.locator(".nz-check-meta b").first().innerText().then((text) => /^\d+\/\d+ 前/.test(text)), "bookings carry the visitor's dates");
  await page.getByLabel("要办的事").fill("换一点外币现金");
  await page.getByRole("button", { name: "＋ 加进清单" }).click();
  await page.reload();
  check(await page.locator(".nz-check-group", { hasText: "新加的" }).innerText().then((text) => text.includes("换一点外币现金")), "own checklist item stays after reload");

  await page.goto(`${base}/mine`);
  const [planText] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "导出文字版" }).click()]);
  const planMarkdown = readFileSync(await planText.path(), "utf8");
  check(planMarkdown.includes("## 预算（估算）") && planMarkdown.includes("## 什么时候订什么"), "text export carries budget and bookings");
  const [planFile] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "存成文件" }).click()]);
  const planPath = await planFile.path();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删掉这个方案" }).click();
  await page.locator(".share-empty").waitFor();
  check(await page.locator(".share-empty h1").innerText() === "还没有方案", "deleting the plan leaves an empty page");
  await page.locator('input[type="file"]').setInputFiles(planPath);
  await page.locator(".share-planbar").waitFor();
  check(await page.locator(".nz-day").count() === 15, "opening the saved file brings the plan back");

  // A file saved on another page is refused with a pointer to where it opens, and nothing is replaced.
  await page.locator('input[type="file"]').first().setInputFiles(exportedPath);
  const wrongOnMine = page.locator(".share-warn[role=alert]");
  await wrongOnMine.waitFor();
  check(await wrongOnMine.innerText().then((text) => text.includes("新西兰参考路线存的文件")) && await wrongOnMine.getByRole("link", { name: "去新西兰参考路线" }).count() === 1, "a New Zealand file opened on /mine points to /nz");
  check(await page.locator(".nz-day").count() === 15, "the plan stays when a wrong file is refused");
  await page.goto(`${base}/nz`);
  await page.locator('input[type="file"]').first().setInputFiles(planPath);
  const wrongOnNz = page.locator(".share-warn[role=alert]");
  await wrongOnNz.waitFor();
  check(await wrongOnNz.innerText().then((text) => text.includes("方案存的文件")) && await wrongOnNz.getByRole("link", { name: "去方案页" }).count() === 1, "a plan file opened on /nz points to /mine");
  check(await page.locator("#day-d1 .nz-day-cover strong").innerText() === "改过的第一天", "the New Zealand edits stay when a wrong file is refused");

  // A plan made only of places outside the reference routes still opens.
  const ownContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const ownPage = await ownContext.newPage();
  const ownErrors = [];
  ownPage.on("pageerror", (error) => ownErrors.push(error.message));
  await ownPage.goto(`${base}/plan`);
  for (const name of ["Kurow", "Omarama"]) {
    await ownPage.getByLabel("地方的名字").fill(name);
    await ownPage.getByRole("button", { name: "＋ 加上" }).click();
    if (await ownPage.getByRole("button", { name: "＋ 从全部地点里挑" }).count()) await ownPage.getByRole("button", { name: "＋ 从全部地点里挑" }).click();
  }
  check(await ownPage.locator(".route-stop").count() === 2, "two places of the visitor's own make a route");
  await ownPage.getByRole("button", { name: "按这条路线排出每一天" }).click();
  await ownPage.waitForURL(/\/mine(\?|$)/);
  await ownPage.locator(".share-planbar").waitFor();
  check(await ownPage.locator(".nz-day").count() > 0 && await ownPage.locator(".nz-stage h2", { hasText: "Kurow" }).count() === 1, "a plan of only the visitor's own places opens on /mine");
  // A route kept as a file (the error page saves one) opens again on /plan: stops, nights, first day, party.
  const placeId = (name) => library.places.find((place) => place.name.startsWith(name)).id;
  const draft = { format: "trip-share-route", route: { stops: [{ key: "a", placeId: placeId("基督城"), nights: 3 }, { key: "b", placeId: placeId("Twizel"), nights: 2 }], startDate: "2030-04-05", adults: 3, children: 1, rooms: 2, cars: 1, pace: "easy" } };
  await ownPage.goto(`${base}/plan`);
  ownPage.once("dialog", (dialog) => dialog.accept());
  await ownPage.locator('input[aria-label="选择存过的排路线草稿"]').setInputFiles({ name: "排路线.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(draft)) });
  await ownPage.getByText("已经打开存的草稿。").waitFor();
  check(await ownPage.locator(".route-stop").count() === 2 && await ownPage.locator('.plan-field input[type="date"]').inputValue() === "2030-04-05", "a saved route draft opens again on /plan with its stops and first day");
  check(await ownPage.locator(".plan-choices label.is-chosen strong").innerText() === "松一点", "the opened draft keeps its pace");
  const ownReal = refused.size ? ownErrors.filter((message) => message !== "Failed to fetch") : ownErrors;
  check(ownReal.length === 0, `a plan of only own places has no page errors${ownReal.length ? `: ${ownReal[0]}` : ""}`);
  await ownContext.close();

  // Fields in the editor are 16px, so iOS Safari does not zoom in on them.
  await page.goto(`${base}/mine`);
  await page.getByRole("button", { name: "开始改" }).click();
  await page.locator(".nz-day-head").first().click();
  const fieldSizes = await page.locator(".share-edit-day input, .share-edit-day textarea, .share-edit-block input, .share-edit-block textarea").evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)));
  check(fieldSizes.length > 0 && fieldSizes.every((size) => size >= 16), "editor fields are at least 16px");
  await page.getByRole("button", { name: "改好了" }).click();

  // On paper a day's grids are never split by a page break (Chrome overprints split grids) and map links are left off.
  await page.goto(`${base}/nz`);
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await page.waitForTimeout(300);
  const printed = await page.evaluate(() => ({
    whole: [...document.querySelectorAll(".nz-facts, .nz-meals, .nz-leg")].map((node) => getComputedStyle(node).breakInside),
    maps: [...document.querySelectorAll(".nz-maplink")].filter((node) => node.getClientRects().length > 0).length,
  }));
  check(printed.whole.length > 0 && printed.whole.every((value) => value === "avoid-page"), "printed facts, meals and drive rows are not split across pages");
  check(printed.maps === 0, "printed days leave off the lodging map links");
  await page.emulateMedia({ media: "screen" });

  // Phone widths, with the visitor's plan in place.
  const shots = process.env.E2E_SHOTS || "";
  if (shots) mkdirSync(shots, { recursive: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ["/", "/plan", "/method", "/mine", "/mine/budget", "/mine/prep", "/nz"]) {
      await page.goto(`${base}${route}`);
      await page.waitForTimeout(150);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      check(!wide, `${route} has no sideways scroll at ${width}px`);
      if (shots && width === 390) await page.screenshot({ path: path.join(shots, `${route.replaceAll("/", "_") || "_home"}.png`), fullPage: false });
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const route of ["/", "/plan", "/nz", "/au2026", "/au2026/days", "/mine"]) {
    await page.goto(`${base}${route}`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(!wide, `${route} has no sideways scroll at 1280px`);
  }
  check(outside.size === 0, `no requests to other sites${outside.size ? `: ${[...outside].join(", ")}` : ""}`);
  if (refused.size) console.log(`  (the policy stopped: ${[...refused].join(", ")})`);
  // A host script whose request the policy blocked throws "Failed to fetch" on its own; the site's code catches its own.
  if (refused.size) errors.splice(0, errors.length, ...errors.filter((message) => message !== "Failed to fetch"));
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
    if (serverExit !== null) throw new Error(`next start exited with code ${serverExit}`);
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
