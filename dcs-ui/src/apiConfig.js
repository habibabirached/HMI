/**
 * =============================================================================
 * BACKEND ADDRESS (API BASE URL) — WHY THIS FILE EXISTS, IN VERY PLAIN LANGUAGE
 * =============================================================================
 *
 * When the bundle said “talk to http://localhost:5000”, the *browser* used the
 * user’s own machine — wrong for remote servers. See REACT_APP_API_BASE_URL and Docker proxy.
 *
 * So we stop hard-coding one magic address. Instead we read REACT_APP_API_BASE_URL
 * at **build time** (Create React App bakes env vars into the JavaScript bundle).
 * You set the variable when you build (or in .env.production), rebuild the UI,
 * deploy that build — and the browser now talks to the *real* server hostname
 * or IP where FastAPI / Docker exposes the API.
 *
 * DEFAULT: If you do nothing, we fall back to http://localhost:5000 so local
 * development keeps working the way it always did.
 *
 * SAME-ORIGIN / REVERSE PROXY: If you put nginx (or similar) in front so that
 * https://mysite.com/ serves the UI and https://mysite.com/api/ goes to the
 * backend, set REACT_APP_API_BASE_URL to an EMPTY string in .env.production.
 * Then API calls become "/api/..." relative to the page — same computer from
 * the browser's point of view, no CORS circus.
 *
 * RULES FOR SETTING THE VARIABLE:
 * - No trailing slash (we strip them anyway so you cannot easily foot-gun).
 * - Include scheme: http:// or https:// for absolute URLs.
 * - Must be available when `npm run build` runs — changing .env after build
 *   does nothing until you rebuild; the bundle is already printed on paper.
 *
 * EXAMPLES:
 *   REACT_APP_API_BASE_URL=http://10.202.252.31:5000
 *   REACT_APP_API_BASE_URL=https://power.mycompany.com
 *   REACT_APP_API_BASE_URL=          (empty => same origin, paths like /api/...)
 *
 * IF YOU SEE "Failed to fetch" IN PRODUCTION: come back here first. Nine times
 * out of ten the UI bundle still thinks the API lives on localhost. Rebuild
 * with the correct REACT_APP_API_BASE_URL or empty string behind a proxy.
 *
 * =============================================================================
 */

/**
 * Normalize the backend root URL we attach in front of paths like `/api/configs`.
 *
 * @param {string | undefined} raw Value from Create React App's process.env
 * @returns {string} Base URL with no trailing slash, or '' for relative URLs
 */
function normalizeApiBaseUrl(raw) {
  // Undefined / null => developer did not set anything; behave like the old app.
  if (raw === undefined || raw === null) {
    return 'http://localhost:5000';
  }

  const trimmed = String(raw).trim();

  // Explicit empty: caller wants `fetch("/api/...")` — typical when UI + API
  // share one hostname via reverse proxy.
  if (trimmed === '') {
    return '';
  }

  // Kill trailing slashes so `${base}/api/foo` never becomes `//api/foo`.
  return trimmed.replace(/\/+$/, '');
}

/**
 * Docker dev: set REACT_APP_API_BASE_URL empty + package.json "proxy" -> browser uses
 * /api on port 3000; dev server forwards to dcs-backend. Laptop-only dev: leave unset
 * (localhost:5000) or use a full URL.
 */
export const API_BASE_URL = normalizeApiBaseUrl(process.env.REACT_APP_API_BASE_URL);
