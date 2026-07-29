/**
 * Puck Page Renderer
 * 
 * Renders pages using Puck content data
 * Separates content (editable) from business logic (query data, mutations)
 */

import React from 'react';
import type { PageContent } from '../core/puck/types';
import {
  HeroSection,
  StatGrid,
  Panel,
  TextBlock,
  CTAButton,
  FeatureCard,
} from '../core/puck/config';

interface PuckPageRendererProps {
  content: PageContent;
  dynamicData?: Record<string, any>;
  children?: React.ReactNode;
}

/**
 * Component registry - maps block types to components
 */
const componentRegistry: Record<string, React.ComponentType<any>> = {
  hero: HeroSection.render,
  stats: StatGrid.render,
  panel: Panel.render,
  text: TextBlock.render,
  cta: CTAButton.render,
  feature: FeatureCard.render,
};

/**
 * Render a single content block
 */
function renderBlock(block: any, dynamicData?: Record<string, any>, children?: React.ReactNode) {
  const Component = componentRegistry[block.type];

  if (!Component) {
    console.warn(`Component type "${block.type}" not found`);
    return null;
  }

  // Merge static props with dynamic data
  const props = {
    ...block.props,
    ...(dynamicData && dynamicData[block.id]),
    children,
  };

  return (
    <div key={block.id} data-puck-block={block.type} data-puck-block-id={block.id}>
      <Component {...props} />
    </div>
  );
}

/**
 * Render entire page from Puck content
 */
export function PuckPageRenderer({
  content,
  dynamicData,
  children,
}: PuckPageRendererProps) {
  if (!content || !content.blocks) {
    return <div>No content available</div>;
  }

  return (
    <section className="page-stack" data-page-id={content.id}>
      {content.blocks.map((block) => {
        return renderBlock(block, dynamicData, children);
      })}
      {children}
    </section>
  );
}

/**
 * Hook to get component by type
 */
export function usePuckComponent(type: string) {
  return componentRegistry[type];
}

/**
 * Render individual Puck component
 */
export function RenderPuckComponent({
  type,
  props,
  children,
}: {
  type: string;
  props: Record<string, any>;
  children?: React.ReactNode;
}) {
  const Component = componentRegistry[type];

  if (!Component) {
    return <div>Unknown component: {type}</div>;
  }

  return <Component {...props}>{children}</Component>;
}

/**
 * Create a dynamic page renderer that injects live data
 */
export function createDynamicPageRenderer<T>(
  content: PageContent,
  dataTransform: (data: T) => Record<string, any>
) {
  return (data: T) => {
    const dynamicData = dataTransform(data);
    return <PuckPageRenderer content={content} dynamicData={dynamicData} />;
  };
}
