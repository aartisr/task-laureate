import { Puck } from '@puckeditor/core';
import '@puckeditor/core/dist/index.css';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { defaultPageContents, puckConfig } from '../core/puck/config';
import { puckPageIds, type PuckPageId } from '../core/puck/types';
import { contentToPuckData, puckDataToContent, resetPageContent, savePageContent } from '../infrastructure/puckContent';
import { usePuckContent } from '../components/withPuckEditor';
import { PuckStudioToolbar } from '../components/PuckStudioToolbar';
import { AppIcon } from '../components/AppIcon';

function isPuckPageId(value: string): value is PuckPageId {
  return (puckPageIds as readonly string[]).includes(value);
}

export function PuckEditorPage({ pageId }: { pageId: string }) {
  const navigate = useNavigate();
  const selectedPageId = isPuckPageId(pageId) ? pageId : 'dashboard';
  const content = usePuckContent(selectedPageId);
  const [notice, setNotice] = useState<string | null>(null);

  if (!content) return <main className="page-surface" aria-busy="true">Loading editor…</main>;

  const selectPage = (nextPageId: string) => {
    if (isPuckPageId(nextPageId)) navigate({ to: '/puck/$pageId', params: { pageId: nextPageId } });
  };

  const pages = puckPageIds.map((id) => ({ id, name: defaultPageContents[id].name, path: defaultPageContents[id].path }));
  const restore = () => { resetPageContent(selectedPageId); setNotice(`Restored the ${content.name} default.`); };

  return <main className="puck-studio" aria-label="Content studio">
    <PuckStudioToolbar pages={pages} selectedPageId={selectedPageId} onSelectPage={selectPage} onRestore={restore} />
    {notice ? <p className="puck-studio__notice" role="status"><AppIcon name="check" /> {notice}</p> : null}
    <section className="puck-studio__canvas" aria-label={`Editing ${content.name}`}>
      <div className="puck-studio__canvas-meta">
        <span><AppIcon name="file" /> {content.name}</span>
        <small>The Blocks library opens on the left. Use the panel button in the editor header to collapse or restore it on desktop.</small>
      </div>
      <Puck
        key={selectedPageId}
        config={puckConfig}
        data={contentToPuckData(content)}
        ui={{ leftSideBarVisible: true, plugin: { current: 'blocks' } }}
        headerTitle={`Editing ${content.name}`}
        headerPath={content.path}
        height="min(72rem, calc(100dvh - 18rem))"
        viewports={[
          { width: 360, height: 'auto', label: 'Phone', icon: <AppIcon name="task" /> },
          { width: 768, height: 'auto', label: 'Tablet', icon: <AppIcon name="list" /> },
          { width: 1280, height: 'auto', label: 'Laptop', icon: <AppIcon name="dashboard" /> },
          { width: '100%', height: 'auto', label: 'Full canvas', icon: <AppIcon name="progress" /> },
        ]}
        onPublish={(data) => {
          savePageContent(selectedPageId, puckDataToContent(selectedPageId, data));
          setNotice(`Saved ${content.name} locally.`);
        }}
      />
    </section>
  </main>;
}
