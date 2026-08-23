import type { ReactNode, SVGProps } from 'react';

/**
 * The app's intentionally small icon vocabulary. These icons inherit the
 * surrounding text colour, so they remain legible in every theme without
 * introducing a second visual language through emoji or image assets.
 */
export type AppIconName =
  | 'activity' | 'archive' | 'arrow-left' | 'arrow-right' | 'bell' | 'block'
  | 'check' | 'chevron-down' | 'close' | 'dashboard' | 'file' | 'help'
  | 'calendar' | 'list' | 'menu' | 'more' | 'move' | 'play' | 'plus' | 'progress' | 'search'
  | 'settings' | 'share' | 'spark' | 'task' | 'trash' | 'undo' | 'warning';

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
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  dashboard: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.3 2.2c-1.3 1-1.8 1.5-1.8 2.8" /><path d="M12 17h.01" /></>,
  list: <><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  move: <><path d="M8 7 4 11l4 4M4 11h11" /><path d="m16 5 4 4-4 4M20 9H9" /></>,
  play: <path d="m9 6 9 6-9 6z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  progress: <><path d="M20 12a8 8 0 1 1-3-6.2" /><path d="M20 5v5h-5" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L6.6 17l.1-.1A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.5-1H5.3v-3h.2A1.7 1.7 0 0 0 7 10a1.7 1.7 0 0 0-.3-1.9L6.6 8l2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v3h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
  share: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  spark: <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />,
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
