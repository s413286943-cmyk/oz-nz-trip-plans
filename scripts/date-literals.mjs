// Dates written into code, tests and docs. Example dates stay in March–June and September–November;
// the 2026 route's own dates may appear where they describe that route (with its year or none).
export const EXAMPLE_MONTHS = new Set([3, 4, 5, 6, 9, 10, 11]);

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_WORD = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const monthOf = (word) => MONTHS.indexOf(word.slice(0, 3).toLowerCase()) + 1;

const NUMBER_UNITS = "小时|个?钟头|公里|千米|分钟?|秒|倍|米|元|块|角|万|千|亿|公斤|千克|克|斤|升|毫升|度|折|个|次|岁|寸|尺|星|颗|人|晚|天|年|%|％";

// Two numbers with no month word may be month first (4/9) or day first (18/3, 4/9): both readings count.
const either = (year, a, b) => [[year, a, b], [year, b, a]];
// A ratio is not a date.
const NOT_RATIO = String.raw`(?<!aspect-ratio\s*:\s*)`;

// Each form gives one [year, month, day] reading, or a list of readings when the order can't be told.
const FORMS = [
  [/(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/g, (m) => [m[1], m[2], m[3]]],
  [/(?<![\w-])((?:19|20)\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?![\w-])/g, (m) => [m[1], m[2], m[3]]],
  [new RegExp(`${NOT_RATIO}(?<![\\d:./-])(\\d{1,2})\\/(\\d{1,2})(?![\\d/])`, "g"), (m) => either(null, m[1], m[2])],
  // Day, month and year with one separator (D/M/YYYY, D-M-YY, D.M.YYYY), or month first. With dots
  // the year has four digits, so a version number is not a date.
  [/(?<![\w./^~:-])(\d{1,2})([/-])(\d{1,2})\2((?:19|20)?\d{2})(?![\w.]|[/-]\d)/g, (m) => either(m[4].length === 2 ? `20${m[4]}` : m[4], m[3], m[1])],
  [/(?<![\w./^~:-])(\d{1,2})\.(\d{1,2})\.((?:19|20)\d{2})(?![\w.]|[/-]\d)/g, (m) => either(m[3], m[2], m[1])],
  [/(?<!\d)(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/g, (m) => [m[1], m[2], m[3]]],
  [new RegExp(`\\b${MONTH_WORD}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(\\d{4}))?`, "gi"), (m) => [m[3], monthOf(m[1]), m[2]]],
  [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_WORD}\\b(?:,?\\s*(\\d{4}))?`, "gi"), (m) => [m[3], monthOf(m[2]), m[1]]],
  // M.D or D.M before Chinese words ("M.D 上山"); a measure after it ("1.5 小时") is a number, not a date.
  [new RegExp(`(?<![\\d:./$¥-])(\\d{1,2})\\.(\\d{1,2})(?![\\d.])(?=\\s*[\\u4e00-\\u9fff])(?!\\s*(?:${NUMBER_UNITS}))`, "g"), (m) => either(null, m[1], m[2])],
  // A month and day on their own in quotes, in code: "MM-DD", "--MM-DD" (ISO without a year), "M.D".
  [/(?:["'`]|--)(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])["'`]/g, (m) => [null, m[1], m[2]]],
  // Not a value given to an attribute or a key (r="3.2", "opacity": "0.5"): those are numbers.
  [/(?<![=:]\s*)["'`](\d{1,2})\.(\d{1,2})["'`]/g, (m) => either(null, m[1], m[2])],
  // A date built in code: new Date(year, monthIndex, day), Date.UTC(year, monthIndex, day), { month, day }.
  [/(?:new\s+Date|Date\.UTC)\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\b/g, (m) => [m[1], Number(m[2]) + 1, m[3]]],
  [/\bmonth\s*[:=]\s*(\d{1,2})\s*,\s*day\s*[:=]\s*(\d{1,2})\b|\bday\s*[:=]\s*(\d{1,2})\s*,\s*month\s*[:=]\s*(\d{1,2})\b/gi, (m) => {
    const [month, day] = m[1] ? [m[1], m[2]] : [m[4], m[3]];
    // Counted from 1, or from 0 as Date's months are.
    return [[null, month, day], [null, Number(month) + 1, day]];
  }],
];

// Every date written in `text`, as { text, year, month, day }; impossible month/day pairs are skipped.
export function dateLiterals(input) {
  const text = String(input).normalize("NFKC");
  const found = [];
  for (const [pattern, parts] of FORMS) {
    for (const match of text.matchAll(pattern)) {
      const readings = parts(match);
      for (const reading of Array.isArray(readings[0]) ? readings : [readings]) {
        const [year, month, day] = reading.map((value) => (value == null ? null : Number(value)));
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) found.push({ text: match[0], year, month, day });
      }
    }
  }
  return found;
}

const key = (month, day) => month * 100 + day;

// The first and last day of a route's data, read from its days' dates.
export function routeWindow(route) {
  const dates = (route.days || []).map((day) => day.date).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date || "")).sort();
  if (!dates.length) return null;
  const [year, fromMonth, fromDay] = dates[0].split("-").map(Number);
  const [, toMonth, toDay] = dates.at(-1).split("-").map(Number);
  return { year, from: key(fromMonth, fromDay), to: key(toMonth, toDay) };
}

export function exampleDateProblems(text, window) {
  return dateLiterals(text)
    .filter(({ year, month, day }) => {
      if (EXAMPLE_MONTHS.has(month)) return false;
      const own = window && (year == null || year === window.year) && key(month, day) >= window.from && key(month, day) <= window.to;
      return !own;
    })
    .map(({ text }) => `date outside the example months (${text})`);
}
