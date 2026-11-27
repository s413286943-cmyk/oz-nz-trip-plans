"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { loadCopy } from "@/lib/edits";

// Coming back to the home page: a plan saved on this device is one tap away.
export default function HomeResume() {
  const [plan, setPlan] = useState(null);
  useEffect(() => {
    let found = null;
    try {
      const copy = loadCopy(window.localStorage, "mine");
      if (copy?.data?.days?.length) found = { days: copy.data.days.length };
    } catch {
      found = null;
    }
    Promise.resolve().then(() => setPlan(found));
  }, []);
  if (!plan) return null;
  return (
    <p className="share-message share-home-resume" role="status">
      这台设备上有一份 {plan.days} 天的方案。<Link href="/mine">接着看方案</Link>
    </p>
  );
}
