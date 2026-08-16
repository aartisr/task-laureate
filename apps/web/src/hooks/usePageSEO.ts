/**
 * usePageSEO — Per-route dynamic SEO
 *
 * Updates document.title, meta description, og:title, og:description,
 * og:url, twitter:title, twitter:description, canonical, and injects
 * per-route JSON-LD BreadcrumbList for rich results on every route change.
 * Zero dependencies beyond React.
 */
import { useEffect } from 'react';
import { SITE_NAME, SITE_URL } from '../config/site';

export interface PageSEOMeta {
  title: string;
  description: string;
  /** Absolute URL for the canonical / og:url (defaults to current href) */
  url?: string;
  /** og:image override (defaults to /og-image.svg) */
  image?: string;
  /** Breadcrumb path for JSON-LD */
  breadcrumb?: ReadonlyArray<{ readonly name: string; readonly url: string }>;
  /** Keep private, account-specific workspace views out of search indexes. */
  noindex?: boolean;
}

const BASE_URL = SITE_URL;
const DEFAULT_IMAGE = '/og-image-v2.png';
const AUTHOR_NAME = 'Aarti S Ravikumar';

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(id: string, data: object) {
  const existingId = `jsonld-${id}`;
  let el = document.querySelector<HTMLScriptElement>(`script[data-jsonld="${existingId}"]`);
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.setAttribute('data-jsonld', existingId);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function usePageSEO({ title, description, url, image, breadcrumb, noindex = false }: PageSEOMeta) {
  useEffect(() => {
    const fullTitle = `${title} — ${SITE_NAME}`;
    const canonical = url ?? `${BASE_URL}${window.location.pathname}`;
    const ogImage = image ?? `${BASE_URL}${DEFAULT_IMAGE}`;

    // Title
    document.title = fullTitle;

    // Canonical
    setLink('canonical', canonical);

    // Standard meta
    setMeta('description', description);
    setMeta('author', AUTHOR_NAME);
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');

    // Open Graph
    setMeta('og:title', fullTitle, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:url', canonical, 'property');
    setMeta('og:image', ogImage, 'property');
    setMeta('og:site_name', SITE_NAME, 'property');
    setMeta('og:type', 'website', 'property');

    // Twitter
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', description);
    setMeta('twitter:image', ogImage);
    setMeta('twitter:card', 'summary_large_image');

    // Per-route WebPage JSON-LD (helps AI understand each page)
    setJsonLd('webpage', {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': canonical,
      'url': canonical,
      'name': fullTitle,
      'description': description,
      'isPartOf': { '@id': `${BASE_URL}/#website` },
      'author': { '@id': `${BASE_URL}/#author` },
      'image': ogImage,
      'breadcrumb': breadcrumb ? {
        '@type': 'BreadcrumbList',
        'itemListElement': breadcrumb.map((item, i) => ({
          '@type': 'ListItem',
          'position': i + 1,
          'name': item.name,
          'item': item.url,
        })),
      } : undefined,
    });
  }, [title, description, url, image, breadcrumb, noindex]);
}

// ── Per-route SEO presets ────────────────────────────────────────────────────

const HOME = { name: 'Dashboard', url: `${BASE_URL}/` };
const SITE = (name: string, path: string) => [HOME, { name, url: `${BASE_URL}${path}` }];

export const PAGE_SEO = {
  dashboard: {
    title: 'Dashboard',
    description: 'Your productivity snapshot. See all lists, task counts, completion rate, and active work — all in one calm view.',
    breadcrumb: [HOME],
  },
  listsOverview: {
    title: 'All Lists',
    description: 'Browse and manage every task list with visual progress rings, filters, and sorting. See exactly where each project stands.',
    breadcrumb: SITE('All Lists', '/lists-overview'),
    noindex: true,
  },
  tasks: {
    title: 'All Tasks',
    description: 'Every task across all lists in one place. Group by list, priority, or status. Filter, search, and mark things done instantly.',
    breadcrumb: SITE('All Tasks', '/tasks'),
    noindex: true,
  },
  completed: {
    title: 'Completed Tasks',
    description: "Celebrate your wins. See every completed task with a timeline of accomplishments and per-list completion rates.",
    breadcrumb: SITE('Completed', '/completed'),
    noindex: true,
  },
  progress: {
    title: 'Progress & Analytics',
    description: 'Deep insights into your productivity: overall completion rate, priority breakdown, lists leaderboard, and overdue tracking.',
    breadcrumb: SITE('Progress', '/progress'),
    noindex: true,
  },
  search: {
    title: 'Search',
    description: 'Find any list or task instantly. Full-text search across titles, descriptions, tags, and notes.',
    breadcrumb: SITE('Search', '/search'),
    noindex: true,
  },
  activity: {
    title: 'Activity Timeline',
    description: 'A complete audit trail of every action taken — created, updated, completed, archived — across all lists and tasks.',
    breadcrumb: SITE('Activity', '/activity'),
    noindex: true,
  },
  settings: {
    title: 'Settings',
    description: 'Customise Task-Laureate to your taste. Switch between Dark Pro, Luxury Minimal, and Warm & Community themes.',
    breadcrumb: SITE('Settings', '/settings'),
    noindex: true,
  },
  support: {
    title: 'Help & Support',
    description: 'Answers to every question, keyboard shortcuts, quick-navigation links, and ways to connect with the community.',
    breadcrumb: SITE('Help & Support', '/support'),
  },
  privacy: {
    title: 'Privacy Notice',
    description: 'How Task-Laureate handles task data, optional Google Calendar scheduling, AI decomposition, cloud sync, and your privacy choices.',
    breadcrumb: SITE('Privacy', '/privacy'),
  },
  listDetail: (listTitle: string) => ({
    title: listTitle,
    description: `Manage tasks in "${listTitle}". Add, prioritise, complete, and track every item in this list.`,
    breadcrumb: [
      HOME,
      { name: 'All Lists', url: `${BASE_URL}/lists-overview` },
      { name: listTitle, url: `${BASE_URL}/lists` },
    ],
    noindex: true,
  }),
} as const;
