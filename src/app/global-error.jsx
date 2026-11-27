"use client";

import "@/styles/atlas/tokens.css";
import "@/styles/nz.css";
import "@/styles/share.css";

import RecoverPage from "@/components/RecoverPage";

// When even the page frame fails. Reloading is the only safe way to try again here.
export default function GlobalError() {
  return (
    <html lang="zh-CN">
      <body>
        <RecoverPage />
      </body>
    </html>
  );
}
