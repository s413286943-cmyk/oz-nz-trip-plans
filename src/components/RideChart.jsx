import { rideRidge } from "@/lib/ride";

export { rideRidge };

export default function RideChart({ ridge }) {
  const { width, height, base, line, first, last, peaks, ticks } = ridge;
  return (
    <svg className="share-ridge" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`每天开车时长的起伏，${peaks.map((peak) => peak.day).join("和")}最长`}>
      <defs>
        <linearGradient id="share-snow" x1="0" y1={base - 86} x2="0" y2={base} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5C8F86" />
          <stop offset=".45" stopColor="#9CBFB4" />
          <stop offset="1" stopColor="#DFEAE3" />
        </linearGradient>
        <clipPath id="share-above"><rect width={width} height={base} /></clipPath>
      </defs>
      <path clipPath="url(#share-above)" d={`${line} L${last[0]},${base + 20} L${first[0]},${base + 20}Z`} fill="url(#share-snow)" />
      <line x1="0" x2={width} y1={base} y2={base} stroke="#B9CBC3" strokeWidth="1" />
      {peaks.map((peak) => (
        <g key={peak.day}>
          <circle cx={peak.x} cy={peak.y} r="4" fill="#C8502B" />
          <text x={peak.labelX ?? peak.x} y={peak.y - 22} textAnchor="middle" fontSize="13" fontWeight="700" className="share-ridge-ink">{peak.day}</text>
          <text x={peak.labelX ?? peak.x} y={peak.y - 8} textAnchor="middle" fontSize="13" className="share-ridge-soft">{peak.hours}</text>
        </g>
      ))}
      {ticks.map((tick) => <text key={tick.number} x={tick.x} y={height - 8} textAnchor="middle" fontSize="13" className="share-ridge-soft">{tick.number}</text>)}
    </svg>
  );
}
