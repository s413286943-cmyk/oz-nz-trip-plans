"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { localToday } from "@/lib/dates";
import { shortDate } from "@/lib/format";
import { ownTimeline } from "@/lib/compose";
import { changePrep, checksKey, emptyPrep, mergePrep, prepKey, readChecks, readPrep, setCheck, writePrep } from "@/lib/sideStore";
import { useTripCopy } from "@/lib/useTripCopy";

import CopyNotes from "./CopyNotes";

let counter = 0;
const NO_PREP = { added: [], hidden: [] };

// What to book when (from the route data, on the visitor's dates), what to get ready, and the visitor's own items.
export default function PrepList({ tripId, original, library = null }) {
  const copy = useTripCopy(tripId, original);
  const data = copy.data;
  const [done, setDone] = useState({});
  const [hideDone, setHideDone] = useState(false);
  const [today, setToday] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  // On our reference routes the visitor's checklist changes are kept apart from the route (see sideStore).
  const [side, setSide] = useState(NO_PREP);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        return { checks: readChecks(window.localStorage, tripId), prep: readPrep(window.localStorage, tripId) };
      } catch {
        return { checks: {}, prep: NO_PREP };
      }
    };
    const first = read();
    Promise.resolve().then(() => {
      setDone(first.checks);
      setSide(first.prep);
      setToday(localToday());
    });
    // Ticked or changed in another tab.
    const onStorage = (event) => {
      if (event.key !== null && event.key !== checksKey(tripId) && event.key !== prepKey(tripId)) return;
      const next = read();
      setDone(next.checks);
      setSide(next.prep);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [tripId]);

  // Each change is made on what storage holds now, so another tab's change saved a moment ago stays.
  // Returns what was saved, or null when nothing could be.
  const write = (save) => {
    try {
      const saved = save(window.localStorage);
      setSaveFailed(false);
      return saved;
    } catch {
      setSaveFailed(true);
      return null;
    }
  };

  const toggle = (id, value) => {
    const saved = write((storage) => setCheck(storage, tripId, id, value));
    setDone(saved || ((current) => {
      const { [id]: _old, ...rest } = current;
      return value ? { ...rest, [id]: true } : rest;
    }));
  };

  // A copy saved by an older version kept our route's checklist changes inside it: move them next to it.
  const legacy = !library && copy.mine && !emptyPrep(data.prep);
  const { apply, reset } = copy;
  useEffect(() => {
    if (!legacy) return;
    const moved = mergePrep(readPrep(window.localStorage, tripId), data.prep);
    try {
      writePrep(window.localStorage, tripId, moved);
    } catch {
      return;
    }
    const { prep: _moved, ...rest } = data;
    // When the checklist was the only change, the route goes back to following ours (and its updates).
    const onlyChecklist = JSON.stringify(rest) === JSON.stringify(original);
    Promise.resolve().then(() => {
      setSide(moved);
      if (onlyChecklist) reset();
      else apply(({ prep: _old, ...route }) => route);
    });
  }, [legacy, data, original, tripId, apply, reset]);

  const prep = library ? data.prep || NO_PREP : mergePrep(side, legacy ? data.prep : null);
  const hidden = new Set(prep.hidden || []);
  const setPrep = (change) => {
    if (library) {
      copy.apply((current) => ({ ...current, prep: change(current.prep || NO_PREP) }));
      return;
    }
    const saved = write((storage) => changePrep(storage, tripId, change));
    setSide(saved || change(prep));
  };
  const hide = (id) => setPrep((current) => ({ ...current, hidden: [...(current.hidden || []), id] }));
  const unhideAll = () => setPrep((current) => ({ ...current, hidden: [] }));
  const removeOwn = (id) => setPrep((current) => ({ ...current, added: (current.added || []).filter((item) => item.id !== id) }));
  const addOwn = (title, detail) => {
    counter += 1;
    const item = { id: `mine-${Date.now().toString(36)}${counter}`, title, detail };
    setPrep((current) => ({ ...current, added: [...(current.added || []), item] }));
  };

  const startDate = data.plan?.startDate || "";
  const own = Boolean(library && copy.mine && data.plan?.stops);
  const timeline = own
    ? ownTimeline(library, data, startDate, today).map((item) => ({ ...item, id: `plan:${item.id}`, dueLabel: dueLabel(item) }))
    : [];
  const todos = data.todos || [];
  const hint = startDate ? `按第 1 天（${shortDate(startDate)}）往前推` : "还没填出发日，先按提前多少天写";
  const groups = [
    ...(own ? [
      { id: "when", title: "什么时候订什么", hint, items: timeline.filter((item) => item.kind === "book") },
      { id: "ready", title: "出发前要办的", hint, items: timeline.filter((item) => item.kind === "prep") },
    ] : []),
    { id: "book", title: "要提前订的", hint: "机票、住宿、租车、餐厅和活动", items: todos.filter((todo) => todo.kind === "book") },
    { id: "prep", title: "要准备的", hint: "证件、行李和出发前要弄清楚的事", items: todos.filter((todo) => todo.kind !== "book").sort((a, b) => a.sortOrder - b.sortOrder) },
    // Without a plan there is nothing to add to yet (it would not be kept).
    ...(library && !own ? [] : [{ id: "mine", title: "新加的", hint: "", items: (prep.added || []).map((item) => ({ ...item, dueLabel: "", mine: true })) }]),
  ].map((group) => ({ ...group, items: group.items.filter((item) => !hidden.has(item.id)) }));

  const all = groups.flatMap((group) => group.items);
  const doneCount = all.filter((item) => done[item.id]).length;
  const percent = all.length ? Math.round((doneCount / all.length) * 100) : 0;
  // The visitor's own checklist waits for the plan saved on this device, instead of first showing an empty one.
  if (library && !copy.ready) return null;

  return (
    <>
      <section className="nz-check-head" aria-label="清单进度">
        <h1>出发前清单</h1>
        <p className="share-lede">
          {own
            ? (startDate ? "按路线和出发日排好了，照着勾就行。勾选只存在这台设备上。" : <>在<Link href="/mine">行程页</Link>填上第 1 天，这里会排成具体日期。</>)
            : library
              ? <>先<Link href="/plan">排好路线</Link>，这里会按路线列出要订、要办的事。</>
              : "参考路线出发前要办的事，照着勾就行。勾选只存在这台设备上。"}
        </p>
        <p><b>{doneCount}</b> / {all.length} 已办完</p>
        <div className="nz-progress" role="progressbar" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={doneCount} aria-label="已办完">
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="nz-check-tools">
          {hidden.size > 0 ? <button type="button" className="share-link" onClick={() => setShowHidden(!showHidden)}>删掉了 {hidden.size} 项</button> : <span />}
          <label className="nz-switch">
            <input type="checkbox" checked={hideDone} onChange={(event) => setHideDone(event.target.checked)} />
            隐藏已办完的
          </label>
        </div>
        <CopyNotes copy={copy} tripId={tripId} saveFailed={saveFailed} />
        {showHidden && hidden.size > 0 && (
          <p className="share-fine">删掉的不会再出现。<button type="button" className="share-link" onClick={unhideAll}>全部恢复</button></p>
        )}
      </section>

      {groups.map((group) => {
        if (["book", "prep"].includes(group.id) && !group.items.length) return null;
        const visible = hideDone ? group.items.filter((item) => !done[item.id]) : group.items;
        const remaining = group.items.filter((item) => !done[item.id]).length;
        return (
          <section className="nz-check-group" key={group.id} aria-label={group.title}>
            <header>
              <h2>{group.title}</h2>
              <span>{group.items.length ? (remaining ? `还剩 ${remaining}` : "都办完了") : ""}</span>
            </header>
            {group.hint && <p className="nz-check-hint">{group.hint}</p>}
            <ul>
              {visible.map((item) => (
                <li key={item.id} className={["nz-check", done[item.id] ? "is-done" : "", item.late && !done[item.id] ? "is-late" : ""].filter(Boolean).join(" ")}>
                  <label>
                    <input type="checkbox" checked={Boolean(done[item.id])} onChange={(event) => toggle(item.id, event.target.checked)} />
                    <span className="nz-check-box" aria-hidden="true" />
                    <span className="nz-check-text">
                      <span className="nz-check-meta">
                        {item.dueLabel && <b>{item.dueLabel}</b>}
                        {item.day && <span>第 {item.day.number} 天 · {item.day.title}</span>}
                        {item.optional && <span>可选</span>}
                      </span>
                      <strong>{item.title}</strong>
                      {item.detail && <small>{item.detail}</small>}
                    </span>
                  </label>
                  <button type="button" className="share-check-remove" aria-label={`删掉「${item.title}」`} onClick={() => (item.mine ? removeOwn(item.id) : hide(item.id))}>删掉</button>
                </li>
              ))}
              {group.id !== "mine" && !visible.length && <li className="nz-check-empty">这一组都办完了。</li>}
            </ul>
            {group.id === "mine" && <AddItem onAdd={addOwn} />}
          </section>
        );
      })}
    </>
  );
}

function dueLabel(item) {
  if (!item.due) return item.when;
  return item.late ? `${shortDate(item.due)} 前 · 已经过了，尽快` : `${shortDate(item.due)} 前`;
}

function AddItem({ onAdd }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const submit = (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), detail.trim());
    setTitle("");
    setDetail("");
  };
  return (
    <form className="share-check-add" onSubmit={submit}>
      <input value={title} placeholder="比如：换一点外币现金" aria-label="要办的事" onChange={(event) => setTitle(event.target.value)} />
      <input value={detail} placeholder="补充说明（可不填）" aria-label="补充说明" onChange={(event) => setDetail(event.target.value)} />
      <button type="submit" className="share-add">＋ 加进清单</button>
    </form>
  );
}
