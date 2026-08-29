/**
 * Puck Content Manager
 * 
 * Handles loading, saving, and managing Puck page content
 * Can be extended to persist to database or Vercel Postgres
 */

import type { PageContent } from '../core/puck/types';
import { defaultPageContents, puckComponentNames } from '../core/puck/config';

const storageKey = 'task-laureate.puck-content.v1';
type ContentListener = () => void;
const listeners = new Set<ContentListener>();

// In-memory cache for page contents (production: use database)
const pageContentCache = new Map<string, PageContent>();

// Initialize with defaults
Object.entries(defaultPageContents).forEach(([key, content]) => {
  pageContentCache.set(key, content);
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function loadPersistedContent() {
  if (typeof window === 'undefined') return;
  try {
    const persisted = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as Record<string, PageContent>;
    Object.entries(persisted).forEach(([id, content]) => {
      if (defaultPageContents[id] && content?.id === id && Array.isArray(content.blocks)) {
        pageContentCache.set(id, content);
      }
    });
  } catch {
    // A corrupt editorial draft must never prevent the application from loading.
  }
}

function persistAndNotify() {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, JSON.stringify(getAllPageContents()));
  }
  listeners.forEach((listener) => listener());
}

loadPersistedContent();

/**
 * Get page content for editing in Puck
 */
export function getPageContent(pageId: string): PageContent | null {
  return pageContentCache.get(pageId) || null;
}

/**
 * Save page content from Puck editor
 */
export function savePageContent(pageId: string, content: PageContent): void {
  if (!defaultPageContents[pageId]) throw new Error(`Unknown Puck page: ${pageId}`);
  pageContentCache.set(pageId, clone({
    ...content,
    id: pageId,
  }));
  persistAndNotify();
}

/**
 * Get all page contents
 */
export function getAllPageContents(): Record<string, PageContent> {
  const result: Record<string, PageContent> = {};
  pageContentCache.forEach((content, key) => {
    result[key] = content;
  });
  return result;
}

/**
 * Reset page to defaults
 */
export function resetPageContent(pageId: string): void {
  const defaults = defaultPageContents[pageId];
  if (defaults) {
    pageContentCache.set(pageId, clone(defaults));
    persistAndNotify();
  }
}

/**
 * Export page content (for backup/version control)
 */
export function exportPageContent(pageId: string): string {
  const content = getPageContent(pageId);
  return content ? JSON.stringify(content, null, 2) : '';
}

/**
 * Import page content (from backup/version control)
 */
export function importPageContent(pageId: string, jsonContent: string): void {
  try {
    const content = JSON.parse(jsonContent) as PageContent;
    savePageContent(pageId, content);
  } catch (error) {
    console.error('Failed to import page content:', error);
  }
}

/**
 * Sync content to Puck data model
 */
export function contentToPuckData(content: PageContent): any {
  return {
    root: { props: {} },
    content: content.blocks.map((block: { id: string; type: string; props: Record<string, unknown> }) => ({
      type: puckComponentNames[block.type as keyof typeof puckComponentNames],
      props: { ...block.props, id: block.id },
    })),
  };
}

/**
 * Sync Puck data back to content model
 */
export function puckDataToContent(pageId: string, puckData: any): PageContent {
  const content = getPageContent(pageId);
  
  return {
    ...content!,
    blocks: (puckData.content || []).map((item: any, idx: number) => ({
      id: item.props?.id || `block-${idx}`,
      type: Object.entries(puckComponentNames).find(([, name]) => name === item.type)?.[0] || 'text',
      props: item.props,
    })),
  };
}

export function subscribeToPuckContent(listener: ContentListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
