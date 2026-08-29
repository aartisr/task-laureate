// Keep the repository-root Vercel project shape equivalent to apps/web.
// This is intentionally a thin entry point: the server-only implementation
// remains owned by the web application and is never bundled for the browser.
export { default, maxDuration } from '../../apps/web/api/cron/notifications.mjs';
