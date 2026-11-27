import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dateLiterals, exampleDateProblems, routeWindow } from "../scripts/date-literals.mjs";

// Dates outside the example months are put together at run time, so this file passes its own check.
const [DEC, JUL, AUG] = [12, 7, 8];
// Full-width digits read the same to a person.
const wide = (text) => text.replace(/[0-9/]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0xfee0));
const iso = (year, month, day) => [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
const pad = (value) => String(value).padStart(2, "0");
// Month and day as one number (month × 100 + day), sorted, so expectations are not dates themselves.
const keys = (text) => dateLiterals(text).map(({ month, day }) => month * 100 + day).sort((a, b) => a - b);
const range = (month, from, to) => Array.from({ length: to - from + 1 }, (_, index) => month * 100 + from + index);

describe("dates written into the repository", () => {
  it("reads every way of writing a date", () => {
    const text = [
      iso(2031, DEC, 24),
      [2031, DEC, 25].join("/"),
      [DEC, 26].join("/"),
      `${DEC} 月 ${27} 日`,
      `${DEC}月${28}号`,
      `Dec ${29}`,
      `${30} December 2031`,
      wide([DEC, 31].join("/")),
    ].join(" · ");
    assert.deepEqual(keys(text), range(DEC, 24, 31));
  });

  it("reads a dotted day before Chinese words and a date built in code", () => {
    const text = [`${DEC}.${9} 上山`, `${DEC}.${10}休息`, `new Date(2031, ${DEC - 1}, ${11})`, `Date.UTC(2031,${DEC - 1},${12})`].join(" · ");
    // Read both ways, M.D gives a day in September or October too; the December ones are what matter.
    assert.deepEqual(keys(text).filter((key) => key > 1200), range(DEC, 9, 12));
    assert.deepEqual(dateLiterals(`${DEC}.${9} 小时 · ${DEC}.${9}公里 · v${DEC}.${9}.0`), []);
  });

  it("reads a day written first, with or without a year", () => {
    // Day first as New Zealand and Australia write it, with each separator, and without a year.
    const text = [[24, DEC, 2031].join("/"), [25, DEC, 2031].join("."), [pad(26), pad(DEC), 2031].join("-"), [27, DEC, 31].join("/"), [28, DEC].join("/"), `${29}.${DEC} 落地`].join(" · ");
    assert.deepEqual(keys(text).filter((key) => key > 1200), range(DEC, 24, 29));
    for (const written of [[24, DEC, 2031].join("/"), [24, DEC, 2031].join("."), [24, DEC, 2031].join("-"), [24, DEC].join("/")]) {
      assert.equal(exampleDateProblems(written, null).length, 1, "a day-first date outside the example months");
    }
    // Both readings count when either number could be the month.
    assert.equal(exampleDateProblems([4, JUL].join("/"), null).length, 1, "the day-first reading lands outside the example months");
    assert.deepEqual(exampleDateProblems([18, 3, 2031].join("/"), null), [], "an example date written day first");
  });

  it("reads ordinal English dates, compact dates and dates written in code", () => {
    const text = [
      `the ${24}th of December`,
      `December ${25}th`,
      `2031${pad(DEC)}${26}`,
      `const k = "${pad(DEC)}-${27}";`,
      `"--${pad(DEC)}-${28}"`,
      `assert.equal(label, "${DEC}.${29}")`,
      `{ month: ${DEC}, day: ${30} }`,
    ].join(" · ");
    assert.deepEqual(keys(text).filter((key) => key > 1200), range(DEC, 24, 30));
  });

  it("skips things that only look like dates", () => {
    assert.deepEqual(dateLiterals("aspect-ratio: 16/9 · 3.5 小时 · 13/40 · 20:30 · grid 1 / span 2"), []);
    // Measures, versions, distances and clock times are numbers.
    assert.deepEqual(dateLiterals(`1.5 小时 · 约 2.5 小时 · v${DEC}.${9}.3 · "next": "${16}.${2}.${10}" · 2.5 km · 10.30 · r="3.2" · "opacity": "0.5"`), []);
  });

  it("keeps examples to the example months, and a route's own dates to that route", () => {
    const window = routeWindow({ days: [{ date: iso(2029, JUL, 1) }, { date: iso(2029, JUL, 5) }] });
    assert.deepEqual(window, { year: 2029, from: 701, to: 705 });
    assert.deepEqual(exampleDateProblems(`2030-03-18 · 2030-11-20 · ${JUL}月${2}日 · ${iso(2029, JUL, 3)}`, window), []);
    assert.equal(exampleDateProblems(iso(2031, JUL, 3), window).length, 1, "the route's month and day with another year");
    assert.equal(exampleDateProblems([DEC, 24].join("/"), window).length, 1);
    assert.equal(exampleDateProblems(`Aug ${AUG - 6}`, window).length, 1);
  });
});
