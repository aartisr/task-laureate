/**
 * The one public identity used by runtime SEO, analytics, and product links.
 * Change VITE_PUBLIC_SITE_URL per deployment rather than copying domains into
 * features. The fallback is the documented production domain.
 */
const fallbackUrl = 'https://tasks.ai-aarti.com';

function normalizeSiteUrl(value: string | undefined): string {
  if (!value) return fallbackUrl;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallbackUrl;
    return url.origin;
  } catch {
    return fallbackUrl;
  }
}

export const SITE_URL = normalizeSiteUrl(import.meta.env.VITE_PUBLIC_SITE_URL);
export const SITE_NAME = 'Task-Laureate';

export function publicUrl(path = '/'): string {
  return new URL(path, `${SITE_URL}/`).toString().replace(/\/$/, path === '/' ? '/' : '');
}
