/**
 * Puck Editor Integration Utilities
 * 
 * Higher-order components and hooks for pages that integrate with Puck
 */

import React, { useMemo } from 'react';
import type { PageContent } from '../core/puck/types';
import { getPageContent } from '../infrastructure/puckContent';
import { PuckPageRenderer } from './PuckPageRenderer';

interface WithPuckEditorProps {
  pageId: string;
  data?: any;
  dataMapper?: (data: any) => Record<string, any>;
  fallback?: React.ReactNode;
}

/**
 * HOC to make a page Puck-editable
 * Loads content from Puck and merges with live data
 */
export function withPuckEditor<P extends object>(
  Component: React.ComponentType<P & { puckContent: PageContent; dynamicData?: Record<string, any> }>
) {
  return function PuckEditorWrapper({
    pageId,
    data,
    dataMapper,
    ...props
  }: WithPuckEditorProps & P) {
    const puckContent = useMemo(() => getPageContent(pageId), [pageId]);
    const dynamicData = useMemo(
      () => (data && dataMapper ? dataMapper(data) : undefined),
      [data, dataMapper]
    );

    if (!puckContent) {
      return <div>Page "{pageId}" not found</div>;
    }

    return (
      <Component
        {...(props as P)}
        puckContent={puckContent}
        dynamicData={dynamicData}
      />
    );
  };
}

/**
 * Hook to get page content
 */
export function usePuckContent(pageId: string) {
  return useMemo(() => getPageContent(pageId), [pageId]);
}

/**
 * Hook to inject dynamic data into page blocks
 */
export function useBlockData(content: PageContent, blockId: string, data: any) {
  const block = content?.blocks.find(b => b.id === blockId);
  return block
    ? {
        ...block.props,
        ...data,
      }
    : null;
}

/**
 * Component to render Puck content with fallback
 */
export function PuckPageWithFallback({
  pageId,
  data,
  dataMapper,
  fallback,
}: WithPuckEditorProps) {
  const puckContent = usePuckContent(pageId);
  const dynamicData = useMemo(
    () => (data && dataMapper ? dataMapper(data) : undefined),
    [data, dataMapper]
  );

  if (!puckContent) {
    return fallback ? <>{fallback}</> : <div>Page not found</div>;
  }

  return <PuckPageRenderer content={puckContent} dynamicData={dynamicData} />;
}

/**
 * Create a Puck-compatible page component
 * Automatically handles content loading and rendering
 */
export function createPuckPage(pageId: string) {
  return function PuckPage({ data, dataMapper }: { data?: any; dataMapper?: (data: any) => Record<string, any> }) {
    const puckContent = usePuckContent(pageId);
    const dynamicData = useMemo(
      () => (data && dataMapper ? dataMapper(data) : undefined),
      [data, dataMapper]
    );

    if (!puckContent) {
      return <div>Page "{pageId}" not configured</div>;
    }

    return <PuckPageRenderer content={puckContent} dynamicData={dynamicData} />;
  };
}
