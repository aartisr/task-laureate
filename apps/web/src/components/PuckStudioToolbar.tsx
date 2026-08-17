import { Link } from '@tanstack/react-router';
import type { AppIconName } from './AppIcon';
import { AppIcon } from './AppIcon';

export interface PuckStudioPage {
  id: string;
  name: string;
  path: string;
}

interface PuckStudioToolbarProps {
  pages: readonly PuckStudioPage[];
  selectedPageId: string;
  onSelectPage: (pageId: string) => void;
  onRestore: () => void;
}

const pageIcons: Record<string, AppIconName> = {
  dashboard: 'dashboard', lists: 'list', tasks: 'task', completed: 'check', progress: 'progress',
  search: 'search', activity: 'activity', settings: 'settings', support: 'help',
  'shared-with-me': 'share', 'shared-by-me': 'share',
};

/** Keeps page choice, safety actions, and the editing mental model out of Puck's canvas. */
export function PuckStudioToolbar({ pages, selectedPageId, onSelectPage, onRestore }: PuckStudioToolbarProps) {
  const selected = pages.find((page) => page.id === selectedPageId) ?? pages[0];
  return <header className="puck-studio__intro">
    <div className="puck-studio__intro-copy">
      <p className="eyebrow">Content studio</p>
      <h1>Shape the page, not the system.</h1>
      <p>Choose a page, add a block, and edit it directly on the live canvas. Your draft stays private to this browser until you save it.</p>
    </div>
    <div className="puck-studio__steps" aria-label="Editing workflow">
      <span><b>1</b> Choose page</span><span><b>2</b> Add or select</span><span><b>3</b> Check devices</span><span><b>4</b> Save draft</span>
    </div>
    <div className="puck-studio__page-bar" aria-label="Editable pages">
      <div className="puck-studio__pages" role="tablist" aria-label="Choose a page to edit">
        {pages.map((page) => <button
          key={page.id}
          type="button"
          role="tab"
          aria-selected={page.id === selectedPageId}
          className={page.id === selectedPageId ? 'is-selected' : ''}
          onClick={() => onSelectPage(page.id)}
        ><AppIcon name={pageIcons[page.id] ?? 'file'} /><span>{page.name}</span></button>)}
      </div>
      <div className="puck-studio__page-actions">
        {selected ? <Link className="secondary-button" to={selected.path}><AppIcon name="arrow-right" /> View page</Link> : null}
        <button className="puck-studio__restore" type="button" onClick={onRestore}><AppIcon name="undo" /> Restore default</button>
      </div>
    </div>
  </header>;
}
