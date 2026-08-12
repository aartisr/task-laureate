import { Puck } from '@puckeditor/core';
import '@puckeditor/core/dist/index.css';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { defaultPageContents, puckConfig } from '../core/puck/config';
import { puckPageIds, type PuckPageId } from '../core/puck/types';
import { contentToPuckData, puckDataToContent, resetPageContent, savePageContent } from '../infrastructure/puckContent';
import { usePuckContent } from '../components/withPuckEditor';

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

  return (
    <main className="page-surface" aria-label="Page editor">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Content studio</p>
          <h1>Edit application content</h1>
          <p>Changes are stored in this browser until server-side publishing is enabled.</p>
        </div>
        <Link className="secondary-button" to={defaultPageContents[selectedPageId].path}>View page</Link>
      </div>
      <label className="field" htmlFor="puck-page-select">
        <span>Page</span>
        <select id="puck-page-select" value={selectedPageId} onChange={(event) => selectPage(event.target.value)}>
          {puckPageIds.map((id) => <option key={id} value={id}>{defaultPageContents[id].name}</option>)}
        </select>
      </label>
      {notice ? <p role="status">{notice}</p> : null}
      <Puck
        key={selectedPageId}
        config={puckConfig}
        data={contentToPuckData(content)}
        headerTitle={`Editing: ${content.name}`}
        onPublish={(data) => {
          savePageContent(selectedPageId, puckDataToContent(selectedPageId, data));
          setNotice('Saved locally.');
        }}
      >
        <Puck.Preview />
      </Puck>
      <button className="secondary-button" type="button" onClick={() => {
        resetPageContent(selectedPageId);
        setNotice('Restored the default content.');
      }}>
        Restore defaults
      </button>
    </main>
  );
}
