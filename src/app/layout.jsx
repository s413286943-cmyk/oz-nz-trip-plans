import "@/styles/nz2027.css";
import "@/styles/share.css";

export const metadata = {
  title: { default: "澳新两次旅行 · 真实行程和自驾攻略", template: "%s · 澳新两次旅行" },
  description: "2026 年 8 月澳洲自驾、2027 年 2 月悉尼 + 新西兰南北岛的真实行程和攻略，打开就能改成你自己的。",
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
