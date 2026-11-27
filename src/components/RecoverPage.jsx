"use client";

import { useEffect, useState } from "react";

import { routeForPath, savedFiles } from "@/lib/recover";
import { download } from "@/lib/useTripCopy";

// Shown instead of a page that failed. The most likely cause is a change saved on this device, so the page
// offers to keep it as a file and clear it. On /plan the route being laid out and the plan are kept and cleared
// one by one. Plain links and buttons only: this has to work when nothing else does.
export default function RecoverPage({ reset }) {
  const [path, setPath] = useState("");
  const [kinds, setKinds] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let found = [];
    try {
      found = savedFiles(window.localStorage, window.location.pathname).map((file) => file.kind);
    } catch {
      found = [];
    }
    Promise.resolve().then(() => {
      setPath(window.location.pathname);
      setKinds(found);
    });
  }, []);

  const saved = kinds.length > 0;
  const own = routeForPath(path) === "mine";
  const keep = () => {
    try {
      for (const file of savedFiles(window.localStorage, path)) download(file.name, file.text, "application/json");
    } catch {
      setMessage("这台设备上存的修改读不出来。");
    }
  };
  const clear = (kind) => {
    const asks = {
      draft: "清掉排路线页上还没生成的路线？想留着，先点“把存的修改存成文件”。",
      copy: own ? "清掉这台设备上的方案？想留着，先点“把存的修改存成文件”。" : "清掉这台设备上的修改，回到参考路线原版？想留着，先点“把存的修改存成文件”。",
    };
    if (!window.confirm(asks[kind])) return;
    try {
      for (const file of savedFiles(window.localStorage, path)) {
        if (file.kind === kind) window.localStorage.removeItem(file.key);
      }
    } catch {
      // Nothing could be cleared; reloading still tries again.
    }
    window.location.reload();
  };
  const clearLabel = (kind) => (kind === "draft" ? "清掉排了一半的路线" : own ? "清掉存的方案" : "清掉存的修改，回到参考路线");

  return (
    <div className="nz share-recover">
      <section className="share-empty" aria-label="页面没打开">
        <h1>这一页没打开</h1>
        <p className="share-lede">
          {saved
            ? "多半是这台设备上存的修改和现在的页面对不上。先点“再试一次”；还不行，可以把存的修改存成文件，再清掉，页面会回到原来的样子。"
            : "先点“再试一次”，或者回首页重新进来。"}
        </p>
        <button type="button" className="share-cta" onClick={() => (reset ? reset() : window.location.reload())}>再试一次</button>
        {saved && (
          <>
            <button type="button" className="share-link" onClick={keep}>把存的修改存成文件</button>
            {kinds.map((kind) => <button key={kind} type="button" className="share-link" onClick={() => clear(kind)}>{clearLabel(kind)}</button>)}
            <p className="share-fine">存下的文件之后还能打开：行程在行程页点“打开存的文件”，排了一半的路线在排路线页点“打开存的草稿”。</p>
          </>
        )}
        <a className="share-link" href="/">回首页</a>
        {message && <p className="share-warn" role="alert">{message}</p>}
      </section>
    </div>
  );
}
