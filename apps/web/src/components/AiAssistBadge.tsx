import { AppIcon } from './AppIcon';

interface AiAssistBadgeProps {
  children?: string;
  working?: boolean;
  className?: string;
}

/**
 * A deliberately quiet provenance signal for optional AI assistance.
 * It always carries plain-language text, so the sparkle never has to carry
 * meaning by itself and can remain decorative for assistive technology.
 */
export function AiAssistBadge({ children = 'AI-assisted', working = false, className }: AiAssistBadgeProps) {
  return <span className={['ai-assist-badge', working ? 'is-working' : '', className].filter(Boolean).join(' ')}>
    <AppIcon name="spark" />
    <span>{children}</span>
  </span>;
}
