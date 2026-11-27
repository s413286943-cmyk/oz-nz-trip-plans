// The site's Content-Security-Policy. Everything it needs comes from its own address, except the
// weather forecast the visitor's browser asks Open-Meteo for. Anything else a host adds to the
// pages (a statistics or monitoring script) cannot load or send anything.
export const WEATHER_ORIGIN = "https://api.open-meteo.com";
// The Coze editor shows the site in a frame; no other site may.
export const FRAME_PARENTS = ["https://code.coze.cn"];

export function contentSecurityPolicy({ dev = false } = {}) {
  const directives = {
    "default-src": ["'self'"],
    // Next.js puts each page's data in inline scripts; the development server also needs eval.
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", WEATHER_ORIGIN, ...(dev ? ["ws:"] : [])],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'self'", ...FRAME_PARENTS],
  };
  return Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}
