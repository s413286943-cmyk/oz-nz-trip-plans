// The stop whose card shows under the plan's map, or null when no place of the route can be drawn
// (a route made only of places outside the place library, or a file without route stops).
export function mapCardStop(geometry, stopId = "") {
  const stops = geometry?.stops || [];
  return stops.find((stop) => stop.id === stopId) || stops[0] || null;
}

// The card under the map: when you are there and for how long. A place visited twice says so; the
// corner circle holding several places of the other country names them all; a stop whose days were
// all deleted says that instead of a day number.
export function stopCard(picked) {
  const visits = picked.visits.filter((visit) => visit.dayIds?.length);
  const once = (picked.places || [picked.name]).length === 1;
  return {
    ...picked,
    name: once && visits.length > 1 ? `${picked.name}（来 ${visits.length} 次）` : picked.name,
    when: visits.length
      ? visits.map((visit) => (visit.first === visit.last ? `第 ${visit.first} 天` : `第 ${visit.first} 到 ${visit.last} 天`)).join("、") + `，住 ${visits.reduce((sum, visit) => sum + visit.nights, 0)} 晚`
      : "这一站的日子都删掉了",
  };
}
