import assert from "node:assert/strict";
import test from "node:test";

import nextConfig from "../next.config.mjs";
import { contentSecurityPolicy, WEATHER_ORIGIN } from "../scripts/security-headers.mjs";

const directives = (policy) => Object.fromEntries(policy.split("; ").map((part) => {
  const [name, ...values] = part.split(" ");
  return [name, values];
}));

test("the page may only talk to itself and the weather service", () => {
  const policy = directives(contentSecurityPolicy());
  assert.deepEqual(policy["connect-src"], ["'self'", WEATHER_ORIGIN]);
  assert.deepEqual(policy["script-src"], ["'self'", "'unsafe-inline'"], "no outside scripts, no eval in production");
  assert.deepEqual(policy["img-src"], ["'self'", "data:", "blob:"]);
  assert.deepEqual(policy["object-src"], ["'none'"]);
  assert.ok(!policy["frame-ancestors"].includes("*"), "other sites cannot frame the pages");
  assert.ok(!Object.values(policy).flat().some((value) => /volc|apmplus|coze\.cn\/api|https?:\/\/\*/.test(value)), "no statistics hosts");
});

test("the development server keeps working under the policy", () => {
  const policy = directives(contentSecurityPolicy({ dev: true }));
  assert.ok(policy["script-src"].includes("'unsafe-eval'"));
  assert.ok(policy["connect-src"].includes("ws:"));
});

test("every page sends the policy; only pictures are cached for a week", async () => {
  const rules = await nextConfig.headers();
  const all = rules.find((rule) => rule.source === "/:path*");
  assert.ok(all.headers.some((header) => header.key === "Content-Security-Policy"));
  const pictures = rules.find((rule) => /nz\|au2026/.test(rule.source));
  const pattern = new RegExp(`^${pictures.source.replace("/:dir(nz|au2026)/:file(", "/(nz|au2026)/(").replace(/\)$/, ")")}$`);
  for (const file of ["/nz/d01.jpg", "/au2026/cover-a.jpg", "/au2026/guide/D3-42.webp"]) assert.match(file, pattern);
  for (const page of ["/nz", "/nz/costs", "/au2026/days", "/nz/dining"]) assert.doesNotMatch(page, pattern);
  assert.match(pictures.headers[0].value, /max-age=604800/);
});
