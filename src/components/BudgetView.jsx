"use client";

import Link from "next/link";
import { useState } from "react";

import { estimateOwnBudget } from "@/lib/compose";
import { money } from "@/lib/format";
import { useTripCopy } from "@/lib/useTripCopy";

import CopyNotes from "./CopyNotes";
import Stepper from "./Stepper";

const CURRENCY_LABEL = { CNY: "人民币部分", NZD: "纽币部分", AUD: "澳币部分" };

// The visitor's budget, worked out from the days of their own plan.
export default function BudgetView({ original, library }) {
  const copy = useTripCopy("mine", original);
  const data = copy.data;
  const plan = copy.mine && data.plan?.stops ? data.plan : null;
  if (!plan) {
    return copy.ready ? (
      <section className="share-empty" aria-label="还没有方案">
        <h1>预算</h1>
        <p className="share-lede">先排好路线，这里按人数、每处住几晚、开几天车来估。</p>
        <CopyNotes copy={copy} tripId="mine" />
        <Link className="share-cta" href="/plan">开始排路线</Link>
      </section>
    ) : null;
  }
  const party = { adults: plan.adults, children: plan.children || 0, rooms: plan.rooms, cars: plan.cars };
  const budget = estimateOwnBudget(library, data, party, plan.budget || {});
  const currencies = Object.keys(budget.totals);

  const setParty = (patch) => copy.apply((current) => ({ ...current, plan: { ...current.plan, ...patch } }));
  const setPeople = (adults, children) => setParty({ adults, children, rooms: Math.max(1, Math.ceil(adults / 2)) });
  const setLine = (kind, amounts) => copy.apply((current) => {
    const own = { ...(current.plan?.budget || {}) };
    if (amounts) own[kind] = amounts;
    else delete own[kind];
    return { ...current, plan: { ...current.plan, budget: own } };
  });

  return (
    <section className="share-budget" aria-labelledby="budget-title">
      <header className="nz-page-head">
        <p className="nz-eyebrow">方案</p>
        <h1 id="budget-title">预算</h1>
        <p>{budget.note}</p>
      </header>
      <CopyNotes copy={copy} tripId="mine" />

      <div className="share-budget-party">
        <Stepper label="大人" value={party.adults} min={1} max={9} onChange={(value) => setPeople(value, party.children || 0)} />
        <Stepper label="小孩" value={party.children || 0} min={0} max={6} onChange={(value) => setPeople(party.adults, value)} />
        <Stepper label="房间" value={party.rooms} min={1} max={6} onChange={(value) => setParty({ rooms: value })} />
        <Stepper label="车" value={party.cars} min={1} max={3} onChange={(value) => setParty({ cars: value })} />
      </div>
      <p className="share-fine">按 {budget.counts.days} 天、{budget.people} 个人算{budget.counts.carDays ? `，开车 ${budget.counts.carDays} 天` : ""}。改了行程的天数，这里跟着变。</p>

      <div className="share-cost-totals">
        {currencies.map((currency) => (
          <div key={currency}>
            <small>{CURRENCY_LABEL[currency] || currency}</small>
            <strong>{money(Math.round(budget.totals[currency]), currency)}</strong>
          </div>
        ))}
      </div>

      <ul className="share-budget-lines">
        {budget.lines.map((line) => <BudgetLine key={line.kind} line={line} onSave={(amounts) => setLine(line.kind, amounts)} />)}
      </ul>
      <p className="share-fine">按付款时的币种分开算，没有换算合并。</p>
    </section>
  );
}

function BudgetLine({ line, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const currencies = Object.keys({ ...line.estimate, ...line.amounts });
  const start = () => {
    setDraft(Object.fromEntries(currencies.map((currency) => [currency, String(Math.round(line.amounts[currency] || 0))])));
    setEditing(true);
  };
  const save = () => {
    const amounts = Object.fromEntries(Object.entries(draft).map(([currency, value]) => [currency, Number(value) || 0]));
    onSave(amounts);
    setEditing(false);
  };
  return (
    <li className={line.edited ? "is-edited" : ""}>
      <div className="share-budget-row">
        <strong>{line.label}</strong>
        <span>{currencies.map((currency) => money(Math.round(line.amounts[currency] || 0), currency)).join(" + ") || "—"}</span>
      </div>
      <small>{line.note}</small>
      {line.edited && <small className="share-budget-mine">这一行改过；估算是 {currencies.map((currency) => money(Math.round(line.estimate[currency] || 0), currency)).join(" + ")}</small>}
      {editing ? (
        <div className="share-budget-edit">
          {currencies.map((currency) => (
            <label key={currency}>
              {currency}
              <input inputMode="decimal" value={draft[currency] ?? ""} onChange={(event) => setDraft({ ...draft, [currency]: event.target.value.replace(/[^\d.]/g, "") })} />
            </label>
          ))}
          <button type="button" className="is-primary" onClick={save}>存下</button>
          <button type="button" onClick={() => setEditing(false)}>不改了</button>
        </div>
      ) : (
        <div className="share-budget-actions">
          <button type="button" onClick={start}>改金额</button>
          {line.edited && <button type="button" onClick={() => onSave(null)}>用回估算</button>}
        </div>
      )}
    </li>
  );
}
