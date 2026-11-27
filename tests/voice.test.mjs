import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// The site talks to nobody in particular: no 我 / 你 / 我们 / 你们 in anything it says.
// The two routes are "参考路线"; what someone lays out is a "方案". Our trips' own write-ups
// (itinerary days, 2026 notes, the guide) come from the export and are checked there.
const root = new URL("..", import.meta.url).pathname;
const PRONOUN = /我们|你们|你|我/;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

const withoutComments = (code) => code
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((line) => line.replace(/(^|[^:"'`])\/\/.*$/, "$1"))
  .join("\n");

describe("no personal pronouns", () => {
  it("in the site's own words", () => {
    const hits = files(path.join(root, "src"))
      .filter((file) => /\.(jsx?|mjs)$/.test(file))
      .flatMap((file) => withoutComments(readFileSync(file, "utf8")).split("\n").map((line, index) => [file, index + 1, line]))
      .filter(([, , line]) => PRONOUN.test(line))
      .map(([file, line, text]) => `${path.relative(root, file)}:${line} ${text.trim().slice(0, 60)}`);
    assert.deepEqual(hits, []);
  });

  it("in the place library, the route sketch and the method page", () => {
    for (const file of ["data/places.json", "data/nz-overview.json", "content/method.md"]) {
      const text = readFileSync(path.join(root, file), "utf8");
      const match = text.match(new RegExp(`.{0,20}(${PRONOUN.source}).{0,20}`));
      assert.equal(match, null, `${file}: ${match?.[0]}`);
    }
  });
});

// The action is 排路线, going back is 恢复成参考路线, and the page does not talk about 数据.
describe("agreed names", () => {
  it("in the site's own words", () => {
    const OFF = /排行程|恢复原版|回到原版|换回原版|天气数据|存的行程/;
    const hits = files(path.join(root, "src"))
      .filter((file) => /\.(jsx?|mjs)$/.test(file))
      .flatMap((file) => withoutComments(readFileSync(file, "utf8")).split("\n").map((line, index) => [file, index + 1, line]))
      .filter(([, , line]) => OFF.test(line))
      .map(([file, line, text]) => `${path.relative(root, file)}:${line} ${text.trim().slice(0, 60)}`);
    assert.deepEqual(hits, []);
  });
});
