// What each page tells search engines and link previews (WeChat, Xiaohongshu, Bilibili…).
// The preview pictures are the 1200 x 630 cards the export cuts from each route's cover.
export const SITE = "https://oznz-trips.coze.site";
export const SITE_NAME = "澳新自驾";
export const CARDS = {
  nz: { url: "/nz/card.jpg", width: 1200, height: 630, alt: "新西兰参考路线：南岛湖边的公路（示意图）" },
  au2026: { url: "/au2026/card.jpg", width: 1200, height: 630, alt: "澳洲参考路线（示意图）" },
};
export const LIGHT_THEME = "#eef3ee";

// `route` picks the preview picture; a page of the visitor's own plan is not indexed.
export function pageMeta({ title, description, route = "nz", personal = false }) {
  const full = `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "zh_CN",
      title: full,
      description,
      url: "./",
      images: [CARDS[route] || CARDS.nz],
    },
    twitter: { card: "summary_large_image", title: full, description, images: [(CARDS[route] || CARDS.nz).url] },
    ...(personal ? { robots: { index: false, follow: true } } : {}),
  };
}
