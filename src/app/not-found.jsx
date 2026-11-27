import Link from "next/link";

// No canonical and no share card: the root layout's card would point at this missing address.
export const metadata = { title: "没有这一页", alternates: { canonical: null }, openGraph: null, twitter: null };

// An address that does not exist (a typo, or a link to a page that has moved).
export default function NotFound() {
  return (
    <div className="nz share-home share-recover">
      <main className="nz-main">
        <section className="share-empty" aria-labelledby="missing-title">
          <h1 id="missing-title">没有这一页</h1>
          <p className="share-lede">网址可能打错了，或者这一页已经换了地方。从下面接着看：</p>
          <div className="share-home-actions">
            <Link className="share-cta" href="/">回首页</Link>
            <Link className="share-cta is-quiet" href="/#home-ours">看参考路线</Link>
            <Link className="share-cta is-quiet" href="/plan">排路线</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
