import { rulerPercent, skyGradient } from "@/lib/light";

// One day of light from 05:00 to 23:00, with a white mark for each step and, on the road, a mark for now.
export default function DayRuler({ sun, ticks = [], label = "当天的日光", now = null, done = 0 }) {
  return (
    <div className="share-ruler" role="img" aria-label={label}>
      <div className="share-ruler-bar" style={sun ? { background: skyGradient(sun) } : undefined} />
      {ticks.map((minutes, index) => <i key={index} className={index < done ? "is-done" : undefined} style={{ left: `${rulerPercent(minutes).toFixed(1)}%` }} />)}
      {now !== null && <b className="share-ruler-now" style={{ left: `${rulerPercent(now).toFixed(1)}%` }} />}
    </div>
  );
}
