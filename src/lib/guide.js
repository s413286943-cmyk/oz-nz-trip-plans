import { readFileSync } from "node:fs";
import path from "node:path";

import { Marked } from "marked";

// Renders the finished 2026 guide (our own content) to HTML at build time, with ids on headings for the contents list.
export function loadGuide(file = path.join(process.cwd(), "content/au2026-guide.md")) {
  const markdown = readFileSync(file, "utf8").replace(/^#\s+.+\n/, "");
  const [, title = ""] = readFileSync(file, "utf8").match(/^#\s+(.+)$/m) || [];
  const headings = [];
  const used = new Map();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = text.replace(/<[^>]+>/g, "");
        const base = slug(plain);
        const count = used.get(base) || 0;
        used.set(base, count + 1);
        const id = count ? `${base}-${count}` : base;
        if (depth === 2) headings.push({ id, text: plain });
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
      image({ href, text }) {
        return `<figure><img src="${escapeAttr(href)}" alt="${escapeAttr(text)}" loading="lazy" /><figcaption>${text}</figcaption></figure>`;
      },
    },
  });
  const html = marked
    .parse(markdown)
    .replace(/<table>/g, '<div class="share-table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>")
    // Consecutive photos sit in their own paragraph; let them line up as a strip.
    .replace(/<p>((?:<figure>[\s\S]*?<\/figure>\s*){2,})<\/p>/g, '<div class="share-photos">$1</div>')
    .replace(/<p>(<figure>[\s\S]*?<\/figure>)<\/p>/g, "$1");
  return { title, html, headings };
}

function slug(text) {
  return `s-${text.trim().replace(/[\s·：:，,。（）()、/+]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase()}`;
}

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
