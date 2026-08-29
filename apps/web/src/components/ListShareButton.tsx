import type { MouseEventHandler } from 'react';
import '../styles/components/list-share-button.css';
import { AppIcon } from './AppIcon';

interface ListShareButtonProps {
  listTitle: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}

/** Shared, accessible List-share trigger for cards and summary surfaces. */
export function ListShareButton({ listTitle, onClick, className = '' }: ListShareButtonProps) {
  return <button type="button" className={`list-share-button ${className}`.trim()} onClick={onClick} aria-label={`Share List: ${listTitle}`}><AppIcon name="share" /><span>Share</span></button>;
}
