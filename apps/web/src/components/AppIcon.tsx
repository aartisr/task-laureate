import type { ReactNode, SVGProps } from 'react';

/**
 * The app's intentionally small icon vocabulary. These icons inherit the
 * surrounding text colour, so they remain legible in every theme without
 * introducing a second visual language through emoji or image assets.
 */
export type AppIconName =
  | 'activity' | 'archive' | 'arrow-left' | 'arrow-right' | 'bell' | 'block' | 'bold'
  | 'check' | 'chevron-down' | 'close' | 'code' | 'dashboard' | 'file' | 'focus' | 'heading' | 'help'
  | 'italic' | 'calendar' | 'link' | 'list' | 'menu' | 'minus' | 'more' | 'move' | 'play' | 'plus' | 'progress' | 'quote' | 'search'
  | 'settings' | 'share' | 'spark' | 'star' | 'strikethrough' | 'task' | 'trash' | 'undo' | 'warning';

interface AppIconProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'name'> {
  name: AppIconName;
  /** Provide a label only when the icon conveys information on its own. */
  label?: string;
  size?: number | string;
}

const paths: Record<AppIconName, ReactNode> = {
  activity: <><path d="M3 12h4l2.2-7 4 14 2.2-7H21" /></>,
  archive: <><path d="M3 6h18" /><path d="M5 6l1 14h12l1-14" /><path d="M9 10h6" /><path d="M5 3h14l1 3H4l1-3Z" /></>,
  'arrow-left': <path d="m14 6-6 6 6 6" />,
  'arrow-right': <path d="m10 6 6 6-6 6" />,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  block: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
  bold: <><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /></>,
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
  dashboard: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  focus: <><circle cx="12" cy="12" r="3" /><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /></>,
  heading: <><path d="M6 12h12M6 4v16M18 4v16" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.3 2.2c-1.3 1-1.8 1.5-1.8 2.8" /><path d="M12 17h.01" /></>,
  italic: <><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  list: <><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  move: <><path d="M8 7 4 11l4 4M4 11h11" /><path d="m16 5 4 4-4 4M20 9H9" /></>,
  play: <path d="m9 6 9 6-9 6z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  progress: <><path d="M20 12a8 8 0 1 1-3-6.2" /><path d="M20 5v5h-5" /></>,
  quote: <path d="M3 21c3 0 7-1 7-8V5H3v8h4c0 4-2 7-4 8zM14 21c3 0 7-1 7-8V5h-7v8h4c0 4-2 7-4 8z" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L6.6 17l.1-.1A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.5-1H5.3v-3h.2A1.7 1.7 0 0 0 7 10a1.7 1.7 0 0 0-.3-1.9L6.6 8l2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v3h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
  share: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  spark: <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />,
  star: <path d="m12 3 2.78 5.63 6.22.9-4.5 4.38 1.06 6.19L12 17.18 6.44 20.1 7.5 13.91 3 9.53l6.22-.9L12 3Z" />,
  strikethrough: <path d="M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16" />,
  task: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 2.5 2.5L16 9" /></>,
  trash: <><path d="M4 7h16M10 11v5M14 11v5M9 7l1-3h4l1 3M6 7l1 13h10l1-13" /></>,
  undo: <><path d="M9 8 5 12l4 4" /><path d="M5 12h9a5 5 0 0 1 0 10h-1" /></>,
  warning: <><path d="M12 4 21 20H3L12 4Z" /><path d="M12 9v4M12 17h.01" /></>,
};

export function AppIcon({ name, label, size = '1em', className, ...props }: AppIconProps) {
  return <svg
    {...props}
    className={['app-icon', className].filter(Boolean).join(' ')}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    focusable="false"
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
  >
    {paths[name]}
  </svg>;
}

/** Converts legacy feature metadata into the shared icon vocabulary. */
export function appIconFromLegacy(value?: string): AppIconName | null {
  const aliases: Record<string, AppIconName> = {
    '⌂': 'dashboard', '✓': 'task', '🔍': 'search', '⌕': 'search', '⚡': 'spark',
    '☷': 'list', '↗': 'share', '◌': 'activity', '◔': 'progress', '⚙': 'settings',
    '⚙️': 'settings', '?': 'help', '＋': 'plus', '☰': 'menu',
  };
  return value ? aliases[value] ?? null : null;
}
