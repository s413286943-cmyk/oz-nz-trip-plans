import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { CARDS, pageMeta } from "../src/lib/meta.js";

const root = new URL("..", import.meta.url).pathname;

test("every page has its own description and a preview card from its route", () => {
  const pages = ["nz", "nz/costs", "nz/dining", "nz/prep", "au2026", "au2026/guide", "au2026/days", "plan", "method", "mine", "mine/budget", "mine/prep"];
  const descriptions = pages.map((page) => {
    const source = readFileSync(`${root}src/app/${page}/page.jsx`, "utf8");
    const match = source.match(/pageMeta\(\{[^)]*description: "([^"]+)"/);
    assert.ok(match, `${page} describes itself`);
    if (page.startsWith("au2026")) assert.match(source, /route: "au2026"/, `${page} previews the Australia card`);
    if (page.startsWith("mine")) assert.match(source, /personal: true/, `${page} is not indexed`);
    return match[1];
  });
  assert.equal(new Set(descriptions).size, descriptions.length, "no two pages share a description");
});

test("the preview card is the 1200 x 630 picture the export writes", () => {
  for (const card of Object.values(CARDS)) {
    assert.deepEqual([card.width, card.height], [1200, 630]);
    assert.ok(existsSync(`${root}public${card.url}`), `${card.url} exists`);
  }
  const meta = pageMeta({ title: "排路线", description: "x" });
  assert.equal(meta.openGraph.title, "排路线 · 澳新自驾");
  assert.equal(meta.twitter.card, "summary_large_image");
  assert.equal(meta.robots, undefined);
  assert.deepEqual(pageMeta({ title: "方案", description: "y", personal: true }).robots, { index: false, follow: true });
});

test("the site has a Chinese not-found page and real icons", () => {
  const missing = readFileSync(`${root}src/app/not-found.jsx`, "utf8");
  assert.match(missing, /没有这一页/);
  assert.match(missing, /openGraph: null/, "the 404 page does not inherit the site's share card");
  for (const file of ["favicon.ico", "apple-icon.png", "icon.svg"]) assert.ok(existsSync(`${root}src/app/${file}`), file);
});
