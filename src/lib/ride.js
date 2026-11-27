import { smoothPath, textWidth } from "./routeMap.js";

const CHART = { width: 358, height: 158, base: 130, rise: 82 };

// How long you drive each day, drawn as a ridge: the higher the mountain, the longer at the wheel.
export function rideRidge(days) {
  const hours = days.map((day) => Number(day.driveHours) || 0);
  const top = Math.max(4.5, ...hours);
  if (!hours.some(Boolean) || days.length < 2) return null;
  const points = days.map((_, index) => [
    Number((8 + (index * (CHART.width - 16)) / (days.length - 1)).toFixed(1)),
    Number((CHART.base - (hours[index] / top) * CHART.rise).toFixed(1)),
  ]);
  const peaks = days
    .map((day, index) => ({ day, index, hours: hours[index] }))
    .filter((item) => item.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 2)
    .sort((a, b) => a.index - b.index)
    .map(({ day, index, hours: value }) => ({
      x: points[index][0],
      y: points[index][1],
      day: `第 ${index + 1} 天`,
      hours: String(day.transport || "").match(/约?\s?([\d.]+–[\d.]+)\s?小时/)?.[1]?.concat(" 小时") || `约 ${Math.round(value * 10) / 10} 小时`,
    }));
  spreadLabels(peaks);
  const marks = [...new Set([1, Math.round(days.length / 4), Math.round(days.length / 2), Math.round((days.length * 3) / 4), days.length])].filter((number) => number >= 1);
  return { ...CHART, line: smoothPath(points), first: points[0], last: points.at(-1), peaks, ticks: marks.map((number) => ({ number, x: points[number - 1][0] })) };
}

// The two peaks' words side by side: when they would overlap, push them apart (and keep them inside the chart).
function spreadLabels(peaks) {
  const boxes = peaks.map((peak) => ({ peak, width: Math.max(textWidth(peak.day, 13), textWidth(peak.hours, 13)) + 6 }));
  for (const box of boxes) box.at = box.peak.x;
  if (boxes.length === 2) {
    const [a, b] = boxes;
    const overlap = (a.width + b.width) / 2 - (b.at - a.at);
    if (overlap > 0) {
      a.at -= overlap / 2;
      b.at += overlap / 2;
    }
  }
  for (const box of boxes) {
    const shift = Math.max(box.width / 2 - box.at, 0) - Math.max(box.at + box.width / 2 - CHART.width, 0);
    box.at += shift;
  }
  if (boxes.length === 2) {
    const [a, b] = boxes;
    const overlap = (a.width + b.width) / 2 - (b.at - a.at);
    if (overlap > 0) {
      if (a.at - a.width / 2 <= 0) b.at += overlap;
      else a.at -= overlap;
    }
  }
  for (const box of boxes) box.peak.labelX = Number(box.at.toFixed(1));
}
