/**
 * Puck Editor Configuration
 * 
 * Defines all editable components and their schemas for the Puck visual editor
 * These components can be dragged, dropped, and configured in the Puck UI
 */

import type { ContentBlock, PageContent } from './types';

/**
 * Editable Hero Section Component
 */
export const HeroSection = {
  render: (props: any) => (
    <header className="page-hero">
      <div>
        {props.eyebrow && <p className="eyebrow">{props.eyebrow}</p>}
        <h1>{props.heading}</h1>
        {props.subheading && <p className="lede">{props.subheading}</p>}
      </div>
      {(props.cta1 || props.cta2) && (
        <div className="hero-actions">
          {props.cta1 && (
            <a href={props.cta1.link} className="primary-button">
              {props.cta1.text}
            </a>
          )}
          {props.cta2 && (
            <a href={props.cta2.link} className="secondary-button">
              {props.cta2.text}
            </a>
          )}
        </div>
      )}
    </header>
  ),
  fields: {
    eyebrow: { type: 'text', label: 'Eyebrow (optional)' },
    heading: { type: 'text', label: 'Main Heading' },
    subheading: { type: 'textarea', label: 'Subheading/Description' },
    cta1: {
      type: 'object',
      objectFields: {
        text: { type: 'text' },
        link: { type: 'text' },
      },
      label: 'Primary CTA Button',
    },
    cta2: {
      type: 'object',
      objectFields: {
        text: { type: 'text' },
        link: { type: 'text' },
      },
      label: 'Secondary CTA Button',
    },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Heading',
    subheading: '',
  },
};

/**
 * Editable Stat Card Component
 */
export const StatCard = {
  render: (props: any) => (
    <article className="stat-card">
      <div className="stat-card__header">
        {props.icon && <div className="stat-card__icon">{props.icon}</div>}
        <h3>{props.label}</h3>
      </div>
      <div className="stat-card__value">{props.value}</div>
      {props.description && <p className="stat-card__description">{props.description}</p>}
    </article>
  ),
  fields: {
    label: { type: 'text', label: 'Label' },
    value: { type: 'text', label: 'Value' },
    icon: { type: 'text', label: 'Icon (emoji or symbol)' },
    description: { type: 'text', label: 'Description (optional)' },
  },
  defaultProps: {
    label: 'Stat',
    value: '0',
  },
};

/**
 * Editable Stat Grid Component
 */
export const StatGrid = {
  render: (props: any) => (
    <section className="stat-grid" aria-label="Statistics">
      {props.cards?.map((card: any, idx: number) => (
        <article key={idx} className="stat-card">
          <div className="stat-card__header">
            {card.icon && <div className="stat-card__icon">{card.icon}</div>}
            <h3>{card.label}</h3>
          </div>
          <div className="stat-card__value">{card.value}</div>
        </article>
      ))}
    </section>
  ),
  fields: {
    cards: {
      type: 'array',
      arrayFields: {
        label: { type: 'text' },
        value: { type: 'text' },
        icon: { type: 'text' },
      },
      label: 'Cards',
    },
  },
  defaultProps: {
    cards: [
      { label: 'Card 1', value: '0', icon: '📊' },
      { label: 'Card 2', value: '0', icon: '✓' },
    ],
  },
};

/**
 * Editable Panel/Container Component
 */
export const Panel = {
  render: (props: any) => (
    <section className="panel">
      {(props.eyebrow || props.heading) && (
        <div className="panel-heading">
          <div>
            {props.eyebrow && <p className="eyebrow">{props.eyebrow}</p>}
            <h2>{props.heading}</h2>
          </div>
          {props.description && <p>{props.description}</p>}
        </div>
      )}
      <div className="panel-content">{props.children}</div>
    </section>
  ),
  fields: {
    eyebrow: { type: 'text', label: 'Eyebrow (optional)' },
    heading: { type: 'text', label: 'Heading' },
    description: { type: 'textarea', label: 'Description (optional)' },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Section',
    description: '',
  },
};

/**
 * Editable Text Block Component
 */
export const TextBlock = {
  render: (props: any) => (
    <div className="text-block">
      {props.heading && <h2>{props.heading}</h2>}
      {props.content && <div className="formatted-text">{props.content}</div>}
    </div>
  ),
  fields: {
    heading: { type: 'text', label: 'Heading (optional)' },
    content: { type: 'textarea', label: 'Content' },
  },
  defaultProps: {
    heading: '',
    content: 'Add your content here',
  },
};

/**
 * Editable CTA Button Component
 */
export const CTAButton = {
  render: (props: any) => (
    <div className="cta-button-section">
      <a href={props.link} className={`${props.style}-button`}>
        {props.text}
      </a>
    </div>
  ),
  fields: {
    text: { type: 'text', label: 'Button Text' },
    link: { type: 'text', label: 'Link/URL' },
    style: {
      type: 'select',
      label: 'Button Style',
      options: [
        { label: 'Primary', value: 'primary' },
        { label: 'Secondary', value: 'secondary' },
      ],
    },
  },
  defaultProps: {
    text: 'Click me',
    link: '#',
    style: 'primary',
  },
};

/**
 * Editable Feature Card Component
 */
export const FeatureCard = {
  render: (props: any) => (
    <article className="feature-card">
      {props.icon && <div className="feature-card__icon">{props.icon}</div>}
      <h3>{props.title}</h3>
      <p>{props.description}</p>
    </article>
  ),
  fields: {
    icon: { type: 'text', label: 'Icon (emoji)' },
    title: { type: 'text', label: 'Title' },
    description: { type: 'textarea', label: 'Description' },
  },
  defaultProps: {
    icon: '⭐',
    title: 'Feature',
    description: 'Feature description',
  },
};

/**
 * Root Page Layout Component
 */
export const PageLayout = {
  render: (props: any) => (
    <section className="page-stack">
      {props.children}
    </section>
  ),
  fields: {
    // No custom fields - just a container
  },
};

/**
 * Puck Configuration
 * Maps component names to their definitions
 */
export const puckConfig = {
  components: {
    Hero: HeroSection,
    StatCard,
    StatGrid,
    Panel,
    Text: TextBlock,
    Cta: CTAButton,
    Feature: FeatureCard,
  },
  root: PageLayout,
};

/** Maps the stable, application-owned block names to Puck component names. */
export const puckComponentNames: Record<ContentBlock['type'], string> = {
  hero: 'Hero',
  stats: 'StatGrid',
  panel: 'Panel',
  search: 'Text',
  text: 'Text',
  feature: 'Feature',
  cta: 'Cta',
};

/**
 * Default page contents for each page
 */
export const defaultPageContents: Record<string, PageContent> = {
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    path: '/',
    blocks: [
      {
        id: 'hero-1',
        type: 'hero',
        props: {
          eyebrow: 'Dashboard',
          heading: 'Calm, fast task orchestration.',
          subheading:
            'Task-Laureate is structured to stay generic at the core and modular at the edges.',
          cta1: { text: 'Search everything', link: '/search' },
          cta2: { text: 'Review activity', link: '/activity' },
        },
      },
      {
        id: 'stats-1',
        type: 'stats',
        props: {
          cards: [
            { label: 'Lists', value: '0', icon: '📋' },
            { label: 'Tasks', value: '0', icon: '✓' },
            { label: 'Completed', value: '0', icon: '🎉' },
            { label: 'Active', value: '0', icon: '📈' },
          ],
        },
      },
      {
        id: 'panel-1',
        type: 'panel',
        props: {
          eyebrow: 'Lists',
          heading: 'Current work',
        },
      },
    ],
  },
  search: {
    id: 'search',
    name: 'Search',
    path: '/search',
    blocks: [
      {
        id: 'hero-1',
        type: 'hero',
        props: {
          eyebrow: 'Search',
          heading: 'Find any list or task.',
          subheading: 'Search is URL-friendly, cache-aware, and ready for filters.',
        },
      },
      {
        id: 'search-1',
        type: 'search',
        props: {
          placeholder: 'Search lists, tasks, tags, notes...',
        },
      },
    ],
  },
  activity: {
    id: 'activity',
    name: 'Activity',
    path: '/activity',
    blocks: [
      {
        id: 'hero-1',
        type: 'hero',
        props: {
          eyebrow: 'Activity',
          heading: "See what's happening.",
          subheading: 'A complete timeline of changes, assignments, and completions.',
        },
      },
    ],
  },
  settings: {
    id: 'settings',
    name: 'Settings',
    path: '/settings',
    blocks: [
      {
        id: 'hero-1',
        type: 'hero',
        props: {
          eyebrow: 'Settings',
          heading: 'Preferences',
          subheading: 'Customize Task-Laureate to match your perfect workflow.',
        },
      },
    ],
  },
};

/**
 * Defines every routed surface that can have Puck-managed editorial content.
 * Pages not requiring custom seed blocks still receive an editable page frame.
 */
const pageCatalog: Array<Pick<PageContent, 'id' | 'name' | 'path'>> = [
  { id: 'lists', name: 'Lists', path: '/lists-overview' },
  { id: 'tasks', name: 'Tasks', path: '/tasks' },
  { id: 'completed', name: 'Completed', path: '/completed' },
  { id: 'progress', name: 'Progress', path: '/progress' },
  { id: 'support', name: 'Support', path: '/support' },
  { id: 'list-detail', name: 'List details', path: '/lists/$listId' },
  { id: 'task-focus', name: 'Task focus', path: '/lists/$listId/tasks/$taskId' },
  { id: 'shared-with-me', name: 'Shared with me', path: '/shared-with-me' },
  { id: 'shared-by-me', name: 'Shared by me', path: '/shared-by-me' },
  { id: 'accept-share', name: 'Accept share', path: '/share/accept' },
  { id: 'sign-in', name: 'Sign in', path: '/sign-in' },
  { id: 'auth-callback', name: 'Authentication callback', path: '/auth/callback' },
  { id: 'sample-workspace', name: 'Sample workspace', path: '/sample' },
];

for (const page of pageCatalog) {
  defaultPageContents[page.id] = {
    ...page,
    blocks: [{
      id: 'intro',
      type: 'hero',
      props: { eyebrow: page.name, heading: page.name, subheading: '' },
    }],
  };
}
