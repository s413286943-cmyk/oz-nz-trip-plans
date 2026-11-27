const BASE = "https://oznz-trips.coze.site";
const PAGES = ["", "/nz", "/nz/costs", "/nz/dining", "/nz/prep", "/au2026", "/au2026/guide", "/au2026/days", "/plan", "/method"];

export default function sitemap() {
  return PAGES.map((page) => ({ url: `${BASE}${page}` }));
}
