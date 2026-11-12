"use client";

import { useEffect, useState } from "react";

const groups = [
  { id: "book", title: "要提前订的", hint: "机票、住宿、租车、餐厅和活动" },
  { id: "prep", title: "要准备的", hint: "证件、行李和出发前要弄清楚的事" },
];

const checksKey = (tripId) => `trip-share:${tripId}:checks`;

export default function PrepList({ tripId, todos }) {
  const [done, setDone] = useState({});
  const [hideDone, setHideDone] = useState(false);

  useEffect(() => {
    let saved = {};
    try {
      saved = JSON.parse(window.localStorage.getItem(checksKey(tripId)) || "{}") || {};
    } catch {
      saved = {};
    }
    Promise.resolve().then(() => setDone(saved));
  }, [tripId]);

  const toggle = (id, value) => {
    const next = { ...done, [id]: value };
    setDone(next);
    try {
      window.localStorage.setItem(checksKey(tripId), JSON.stringify(next));
    } catch {
      // Ticks stay for this visit only.
    }
  };

  const doneCount = todos.filter((todo) => done[todo.id]).length;
  const percent = todos.length ? Math.round((doneCount / todos.length) * 100) : 0;

  return (
    <>
      <section className="nz-check-head" aria-label="清单进度">
        <h1>出发前清单</h1>
        <p className="share-lede">这是我们出发前列的事，照着勾就行。勾选只存在你这台设备上。</p>
        <p><b>{doneCount}</b> / {todos.length} 已办完</p>
        <div className="nz-progress" role="progressbar" aria-valuemin={0} aria-valuemax={todos.length} aria-valuenow={doneCount} aria-label="已办完">
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="nz-check-tools">
          <span />
          <label className="nz-switch">
            <input type="checkbox" checked={hideDone} onChange={(event) => setHideDone(event.target.checked)} />
            隐藏已办完的
          </label>
        </div>
      </section>

      {groups.map((group) => {
        const items = todos.filter((todo) => (group.id === "book" ? todo.kind === "book" : todo.kind !== "book")).sort((a, b) => a.sortOrder - b.sortOrder);
        const visible = hideDone ? items.filter((todo) => !done[todo.id]) : items;
        const remaining = items.filter((todo) => !done[todo.id]).length;
        return (
          <section className="nz-check-group" key={group.id} aria-label={group.title}>
            <header>
              <h2>{group.title}</h2>
              <span>{remaining ? `还剩 ${remaining}` : "都办完了"}</span>
            </header>
            <p className="nz-check-hint">{group.hint}</p>
            <ul>
              {visible.map((todo) => (
                <li key={todo.id} className={["nz-check", done[todo.id] ? "is-done" : ""].filter(Boolean).join(" ")}>
                  <label>
                    <input type="checkbox" checked={Boolean(done[todo.id])} onChange={(event) => toggle(todo.id, event.target.checked)} />
                    <span className="nz-check-box" aria-hidden="true" />
                    <span className="nz-check-text">
                      <span className="nz-check-meta"><b>{todo.dueLabel}</b></span>
                      <strong>{todo.title}</strong>
                      <small>{todo.detail}</small>
                    </span>
                  </label>
                </li>
              ))}
              {!visible.length && <li className="nz-check-empty">这一组都办完了。</li>}
            </ul>
          </section>
        );
      })}
    </>
  );
}
