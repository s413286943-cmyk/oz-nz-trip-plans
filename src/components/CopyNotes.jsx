"use client";

import { savedAsFile } from "@/lib/recover";
import { download } from "@/lib/useTripCopy";

// The lines every page that edits a copy shows about saving: cannot save here, another tab changed it,
// or what was saved before could not be opened.
export default function CopyNotes({ copy, tripId, saveFailed = false }) {
  const keepBroken = () => {
    try {
      const text = savedAsFile(window.localStorage, `/${tripId}`);
      if (text) download(`${tripId}-行程-打不开的那份.json`, text, "application/json");
    } catch {
      // Nothing to download.
    }
  };
  return (
    <>
      {(!copy.storageOk || saveFailed) && <p className="share-warn" role="alert">这里存不了修改（可能开了无痕模式或存满了），刷新后改动会丢。</p>}
      {copy.notice && <p className="share-message" role="status">{copy.notice}</p>}
      {copy.problem && (
        <p className="share-warn" role="alert">
          这台设备上存过的修改打不开（可能是别的路线的文件，或者已经损坏），现在显示的是原来的样子；再改就会换掉它。
          <button type="button" className="share-link" onClick={keepBroken}>先把它存成文件</button>
        </p>
      )}
    </>
  );
}
