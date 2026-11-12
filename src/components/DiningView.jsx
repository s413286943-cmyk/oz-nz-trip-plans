"use client";

import { MEAL_PERIOD } from "@/lib/edits";
import { MEALS, parseMealPlan, shortDate } from "@/lib/format";
import { useTripCopy } from "@/lib/useTripCopy";

const statusClass = { 要提前订: "is-todo", 不用订: "is-walkin" };

export default function DiningView({ tripId, original }) {
  const { data, mine } = useTripCopy(tripId, original);
  const bookings = new Map((data.dining || []).map((item) => [`${item.dayId}-${item.meal}`, item]));

  return (
    <section className="nz-dining" aria-labelledby="dining-title">
      <header className="nz-page-head">
        <h1 id="dining-title">吃什么</h1>
        <p>每天早午晚吃什么，要提前订的餐厅单独标出来，带营业和订位规矩。{mine ? "早午晚按你改过的行程显示。" : "在“行程”里改了哪天吃什么，这里会跟着变。"}</p>
      </header>

      <ol className="nz-dining-days">
        {data.days.map((day) => {
          const plan = parseMealPlan(day.blocks.find((block) => block.period === MEAL_PERIOD)?.activity);
          return (
            <li key={day.id} id={`dining-${day.id}`} className="nz-dining-day">
              <header>
                <span>{day.label} · {shortDate(day.date)} {day.weekday}</span>
                <strong>{day.base}</strong>
              </header>
              <ul className="nz-meals">
                {MEALS.map((meal) => {
                  const booking = bookings.get(`${day.id}-${meal.id}`);
                  const planned = plan[meal.id];
                  return (
                    <li key={meal.id} className="nz-meal">
                      <div className="nz-meal-head">
                        <span className="nz-meal-label">{meal.label}</span>
                        <p>{booking ? booking.place : planned || "随意"}</p>
                      </div>
                      {booking && (
                        <div className="nz-meal-booking">
                          <span className={`nz-meal-status ${statusClass[booking.status] || ""}`}>{booking.status}</span>
                          {booking.time && <span>{booking.time}</span>}
                          {booking.note && <small>{booking.note}</small>}
                          {booking.resources?.some((resource) => resource.url) && (
                            <span className="nz-meal-links">
                              {booking.resources.filter((resource) => resource.url).map((resource) => (
                                <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer">{resource.type === "map" ? "地图" : "餐厅"}</a>
                              ))}
                            </span>
                          )}
                        </div>
                      )}
                      {booking && planned && !planned.includes(booking.place.split("（")[0].trim()) && <small className="nz-meal-plan">行程里写的：{planned}</small>}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
