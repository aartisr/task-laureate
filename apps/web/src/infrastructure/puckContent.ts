/**
 * Puck Content Manager
 * 
 * Handles loading, saving, and managing Puck page content
 * Can be extended to persist to database or Vercel Postgres
 */

import type { PageContent } from '../core/puck/types';
import { defaultPageContents } from '../core/puck/config';

// In-memory cache for page contents (production: use database)
const pageContentCache = new Map<string, PageContent>();

// Initialize with defaults
Object.entries(defaultPageContents).forEach(([key, content]) => {
  pageContentCache.set(key, content);
});

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
  pageContentCache.set(pageId, {
    ...content,
    id: pageId,
  });
  // TODO: Persist to database
  console.log(`✅ Page "${pageId}" saved`, content);
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
    pageContentCache.set(pageId, JSON.parse(JSON.stringify(defaults)));
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
    root: {
      type: 'PageLayout',
      props: {},
    },
    content: content.blocks.map((block: { type: string; props: Record<string, unknown> }) => ({
      type: block.type.charAt(0).toUpperCase() + block.type.slice(1),
      props: block.props,
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
      id: `block-${idx}`,
      type: item.type.toLowerCase(),
      props: item.props,
    })),
  };
}
