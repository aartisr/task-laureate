import * as handlers from '../../lib/calendar/handlers.mjs';

const routes = { 'google/connect': handlers.connect, 'google/callback': handlers.callback, status: handlers.status, 'task-block': handlers.taskBlock, schedule: handlers.schedule, remove: handlers.remove, disconnect: handlers.disconnect };

/** One Vercel function preserves the public calendar API while staying well below Hobby's function quota. */
export default async function handler(request, response) {
  const path = new URL(request.url, 'https://calendar.local').pathname.replace(/^\/api\/calendar\/?/, '').replace(/\/$/, '');
  const route = routes[path];
  if (!route) return response.status(404).json({ code: 'not_found' });
  return route(request, response);
}
