"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { copyStore, generationOf, openWithSide, replay } from "./copyStore.js";
import { storageKey } from "./edits.js";
import { adoptLeftover } from "./sideStore.js";

// Shows the visitor's own copy when this browser has one, otherwise the original.
// Two tabs of the same route stay in step: a change saved in one shows in the other, and a tab never
// writes over a version it has not seen.
export function useTripCopy(tripId, original) {
  const [copy, setCopy] = useState(null);
  const [storageOk, setStorageOk] = useState(true);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState(false);
  const [notice, setNotice] = useState("");
  const store = useRef(null);
  // The copy as it came from storage: shown, not written back.
  const fromStorage = useRef(null);
  // The changes made since the last save, to do again when another tab saved first.
  const pending = useRef([]);

  const load = useCallback(() => {
    try {
      store.current = store.current || copyStore(window.localStorage, tripId);
      try {
        adoptLeftover(window.localStorage, tripId);
      } catch {
        // The checklist stays where it is; it is still read from there.
      }
      const result = store.current.load();
      fromStorage.current = result.copy;
      return { ...result, ok: true };
    } catch {
      fromStorage.current = null;
      return { copy: null, problem: false, ok: false };
    }
  }, [tripId]);

  useEffect(() => {
    store.current = null;
    const first = load();
    Promise.resolve().then(() => {
      setCopy(first.copy);
      setProblem(first.problem);
      setStorageOk(first.ok);
      setReady(true);
    });
    const onStorage = (event) => {
      if (event.key !== null && event.key !== storageKey(tripId)) return;
      const next = load();
      pending.current = [];
      setCopy(next.copy);
      setProblem(next.problem);
      setNotice(next.copy ? "另一个页面刚改过，这里已经换成那边的版本。" : "另一个页面清掉了修改，这里已经换回参考路线。");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load, tripId]);

  useEffect(() => {
    if (!ready || !copy || copy === fromStorage.current) return;
    try {
      if (!store.current) throw new Error("no storage");
      const result = store.current.save(copy);
      if (!result.saved) {
        // The pending changes were made on what this tab last read or wrote (or on our route).
        const basedOn = generationOf((fromStorage.current ?? { data: original }).data);
        fromStorage.current = result.copy;
        const again = replay(result.copy, pending.current, basedOn);
        if (again) {
          // Saved on the next pass, since it is not what storage holds.
          Promise.resolve().then(() => {
            setCopy(again);
            setProblem(false);
            setNotice("另一个页面刚改过，这里换成了那边的版本，刚才这一下也接着改上了。");
          });
          return;
        }
        pending.current = [];
        Promise.resolve().then(() => {
          setCopy(result.copy);
          setProblem(result.problem);
          setNotice("另一个页面刚改过，这里已经换成那边的版本，刚才这一下没有存，请再改一次。");
        });
        return;
      }
      fromStorage.current = copy;
      pending.current = [];
      Promise.resolve().then(() => {
        setStorageOk(true);
        setProblem(false);
      });
    } catch {
      Promise.resolve().then(() => setStorageOk(false));
    }
  }, [copy, ready, original]);

  const apply = useCallback((change) => {
    setNotice("");
    pending.current.push(change);
    setCopy((current) => {
      try {
        return { baseVersion: current?.baseVersion ?? original.version, data: change(current?.data ?? original) };
      } catch {
        // What the edit was for is gone (see EditConflict): nothing changes.
        return current;
      }
    });
  }, [original]);

  // A file opened from disk (keeping the version of our route it was made from, when the file says) together with what it keeps next to the route (`sideKeys`, written by
  // `writeSide`): saved here and now, all or nothing. Returns "opened", "conflict" (another tab saved first:
  // its version now shows), "failed" (nothing changed), "partial" (it could not be written and storage
  // could not be put back either: what storage holds now shows) or "unsaved" (this browser keeps nothing:
  // it shows for this visit only).
  const open = useCallback((data, baseVersion, sideKeys, writeSide) => {
    const next = { baseVersion: baseVersion || original.version, data };
    if (!store.current) {
      pending.current = [];
      setNotice("");
      setCopy(next);
      return "unsaved";
    }
    const result = openWithSide(window.localStorage, store.current, next, sideKeys, writeSide);
    pending.current = [];
    if (result.opened) {
      fromStorage.current = next;
      setNotice("");
      setProblem(false);
      setStorageOk(true);
      setCopy(next);
      return "opened";
    }
    if (result.conflict) {
      fromStorage.current = result.current.copy;
      setCopy(result.current.copy);
      setProblem(result.current.problem);
      return "conflict";
    }
    if (!result.restored) {
      fromStorage.current = result.current?.copy ?? null;
      setNotice("");
      setCopy(result.current?.copy ?? null);
      setProblem(Boolean(result.current?.problem));
      return "partial";
    }
    return "failed";
  }, [original.version]);

  const reset = useCallback(() => {
    try {
      store.current?.clear();
    } catch {
      // Nothing saved to clear.
    }
    fromStorage.current = null;
    pending.current = [];
    setNotice("");
    setProblem(false);
    setCopy(null);
  }, []);

  return {
    data: copy?.data ?? original,
    mine: Boolean(copy),
    baseVersion: copy?.baseVersion ?? original.version,
    stale: Boolean(copy && copy.baseVersion !== original.version),
    storageOk,
    problem,
    notice,
    ready,
    apply,
    open,
    reset,
  };
}

export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
