"use client";

import { useCallback, useEffect, useState } from "react";

import { clearCopy, loadCopy, saveCopy } from "./edits.js";

// Shows the visitor's own copy when this browser has one, otherwise the original.
export function useTripCopy(tripId, original) {
  const [copy, setCopy] = useState(null);
  const [storageOk, setStorageOk] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let saved = null;
    let ok = true;
    try {
      saved = loadCopy(window.localStorage, tripId);
    } catch {
      ok = false;
    }
    Promise.resolve().then(() => {
      setCopy(saved);
      setStorageOk(ok);
      setReady(true);
    });
  }, [tripId]);

  useEffect(() => {
    if (!ready || !copy) return;
    try {
      saveCopy(window.localStorage, tripId, copy.data, copy.baseVersion);
    } catch {
      Promise.resolve().then(() => setStorageOk(false));
    }
  }, [copy, ready, tripId]);

  const apply = useCallback((change) => {
    setCopy((current) => ({ baseVersion: current?.baseVersion ?? original.version, data: change(current?.data ?? original) }));
  }, [original]);

  const replace = useCallback((data) => setCopy({ baseVersion: original.version, data }), [original.version]);

  const reset = useCallback(() => {
    try {
      clearCopy(window.localStorage, tripId);
    } catch {
      // Nothing saved to clear.
    }
    setCopy(null);
  }, [tripId]);

  return {
    data: copy?.data ?? original,
    mine: Boolean(copy),
    stale: Boolean(copy && copy.baseVersion !== original.version),
    storageOk,
    ready,
    apply,
    replace,
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
