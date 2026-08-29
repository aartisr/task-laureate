import type { CSSProperties } from 'react';
import '../styles/components/progress-ring.css';

export interface ProgressRingProps {
  percent: number;
  size?: number;
  label?: string;
  className?: string;
  /** Smaller strokes fit compact list cards; larger strokes suit reports. */
  inset?: number;
}

/** Accessible, clamped radial completion indicator shared by list and report surfaces. */
export function ProgressRing({ percent, size = 48, label, className = 'progress-ring', inset = 6 }: ProgressRingProps) {
  const safePercent = Math.max(0, Math.min(Math.round(percent), 100));
  const radius = (size - inset) / 2;
  const circumference = 2 * Math.PI * radius;
  const fill = (safePercent / 100) * circumference;
  const complete = safePercent === 100;
  return <svg width={size} height={size} className={className} role={label ? 'img' : undefined} aria-label={label ?? undefined} aria-hidden={label ? undefined : true}>
    <circle cx={size / 2} cy={size / 2} r={radius} className={`${className}__track`} />
    <circle cx={size / 2} cy={size / 2} r={radius} className={`${className}__fill`} strokeDasharray={complete ? `${circumference} 0` : `${fill} ${circumference}`} strokeDashoffset={complete ? 0 : circumference / 4} style={{ '--pct': safePercent } as CSSProperties} />
    <text x="50%" y={label ? '46%' : '54%'} textAnchor="middle" className={label ? `${className}__value` : `${className}__label`}>{safePercent}%</text>
    {label ? <text x="50%" y="64%" textAnchor="middle" className={`${className}__sub`}>{label}</text> : null}
  </svg>;
}
