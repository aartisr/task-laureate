import { AppIcon } from './AppIcon';
import { MAX_FAVORITE_LISTS, toggleListFavorite, useFavoriteListIds } from '../core/preferences/listFavorites';
import { announceToScreenReader } from '../lib/a11y';
import '../styles/components/favorite-list-button.css';

export function FavoriteListButton({ listId, listTitle, className = '' }: { listId: string; listTitle: string; className?: string }) {
  const favoriteIds = useFavoriteListIds();
  const isFavorite = favoriteIds.includes(listId);
  const toggle = () => {
    const result = toggleListFavorite(listId);
    if (result.limitReached) {
      announceToScreenReader(`You can keep up to ${MAX_FAVORITE_LISTS} lists handy. Remove one first.`, 'assertive');
      return;
    }
    announceToScreenReader(result.favorited ? `“${listTitle}” added to Favorites.` : `“${listTitle}” removed from Favorites.`);
  };
  const label = isFavorite ? `Remove ${listTitle} from Favorites` : `Keep ${listTitle} handy`;
  return <button type="button" className={`favorite-list-button ${isFavorite ? 'favorite-list-button--active' : ''} ${className}`.trim()} onClick={toggle} aria-pressed={isFavorite} aria-label={label} title={label}>
    <AppIcon name="star" /> <span className="favorite-list-button__label">{isFavorite ? 'Saved' : 'Keep handy'}</span>
  </button>;
}
