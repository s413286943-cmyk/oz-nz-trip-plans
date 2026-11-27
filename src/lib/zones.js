// The countries a stop can be in and the clocks a place outside the place library can choose.
// Files and saved copies are checked against these lists, so a value never reaches a lookup or a clock unchecked.

export const COUNTRIES = ["nz", "au", "other"];

// Australia has five clocks; a place outside the place library says which one when it is added.
export const AU_ZONES = [
  ["Australia/Sydney", "新州、维州、首都领地、塔州"],
  ["Australia/Brisbane", "昆士兰"],
  ["Australia/Adelaide", "南澳"],
  ["Australia/Darwin", "北领地"],
  ["Australia/Perth", "西澳"],
];

const STOP_ZONES = new Set(AU_ZONES.map(([zone]) => zone));

export const knownCountry = (value) => (COUNTRIES.includes(value) ? value : "");
export const knownStopZone = (value) => (STOP_ZONES.has(value) ? value : "");
