import * as handlers from '../lib/calendar/handlers.mjs';

const routes = Object.freeze({
  'google-connect': handlers.connect,
  'google-callback': handlers.callback,
  status: handlers.status,
  'task-block': handlers.taskBlock,
  schedule: handlers.schedule,
  sync: handlers.sync,
  'google-notification': handlers.googleNotification,
  remove: handlers.remove,
  disconnect: handlers.disconnect,
});

/**
 * One deployable Vercel function behind explicit public-route rewrites.
 * This avoids nested catch-all detection differences while retaining the
 * stable browser URLs and remaining comfortably inside the Hobby quota.
 */
export default async function handler(request, response) {
  const route = new URL(request.url, 'https://calendar.local').searchParams.get('route');
  const action = route ? routes[route] : undefined;
  if (!action) return response.status(404).json({ code: 'not_found' });
  return action(request, response);
}
