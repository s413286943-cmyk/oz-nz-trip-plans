import { money, shortDate } from "@/lib/format";

export default function CostView({ costs, lodgings }) {
  const currencies = Object.keys(costs.totals);
  return (
    <section className="share-costs" aria-labelledby="costs-title">
      <header className="nz-page-head">
        <h1 id="costs-title">花销</h1>
        <p>{costs.note}</p>
      </header>

      <div className="share-cost-totals">
        {currencies.map((currency) => (
          <div key={currency}>
            <small>{currency === "CNY" ? "人民币部分" : currency === "NZD" ? "纽币部分" : currency}</small>
            <strong>{money(costs.totals[currency], currency)}</strong>
          </div>
        ))}
      </div>

      <table className="share-table">
        <caption>按类别</caption>
        <thead>
          <tr><th scope="col">类别</th>{currencies.map((currency) => <th scope="col" key={currency}>{currency}</th>)}</tr>
        </thead>
        <tbody>
          {costs.categories.map((row) => (
            <tr key={row.category}>
              <th scope="row">{row.label}</th>
              {currencies.map((currency) => <td key={currency}>{row.amounts[currency] ? money(row.amounts[currency], currency) : "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="share-fine">按付款时的币种分开记，没有换算合并。</p>

      {lodgings?.length > 0 && (
        <>
          <h2 className="share-h2">每晚住哪、多少钱</h2>
          <ul className="nz-stays">
            {lodgings.map((stay) => (
              <li key={stay.sortOrder}>
                <span className="nz-stays-dates">{shortDate(stay.checkIn)}<i>–</i>{shortDate(stay.checkOut)}</span>
                <div>
                  <strong>{stay.name}</strong>
                  <small>{[stay.room, stay.detail].filter((value) => value && value !== "—").join(" · ")}</small>
                </div>
                {stay.status && <span className="nz-stays-status">{stay.status}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
