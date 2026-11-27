import "@/styles/atlas/tokens.css";
import "@/styles/atlas/itinerary.css";
import "@/styles/atlas/docket.css";
import "@/styles/atlas/route-atlas.css";
import "@/styles/atlas/live-route.css";
import "@/styles/nz.css";
import "@/styles/share.css";

import { CARDS, SITE, SITE_NAME } from "@/lib/meta";

// The site has one public address; the platform's default domain serves the same pages.
const description = "两条澳新自驾参考路线（澳洲冬季、南半球夏季的悉尼和新西兰）的每日行程、攻略和花销；也能自己排路线，生成每天的安排、预算和出发前清单。";
export const metadata = {
  metadataBase: new URL(SITE),
  alternates: { canonical: "./" },
  title: { default: "澳新自驾 · 参考路线和排路线", template: `%s · ${SITE_NAME}` },
  description,
  openGraph: { type: "website", siteName: SITE_NAME, locale: "zh_CN", title: "澳新自驾 · 参考路线和排路线", description, url: "./", images: [CARDS.nz] },
  twitter: { card: "summary_large_image", title: "澳新自驾 · 参考路线和排路线", description, images: [CARDS.nz.url] },
};

export const viewport = {
  themeColor: "#0d1719",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
