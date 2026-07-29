/**
 * Puck Editor Content Types
 * 
 * Defines the structure for all page content that can be edited in Puck
 */

export interface HeroSection {
  eyebrow?: string;
  heading: string;
  subheading?: string;
  cta1?: {
    text: string;
    link: string;
  };
  cta2?: {
    text: string;
    link: string;
  };
}

export interface StatCardData {
  label: string;
  value: string | number;
  icon?: string;
}

export interface StatGridSection {
  cards: StatCardData[];
}

export interface PanelSection {
  eyebrow?: string;
  heading: string;
  description?: string;
  showForm?: boolean;
  formFields?: FormField[];
}

export interface FormField {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'textarea' | 'email' | 'number';
  required?: boolean;
}

export interface SearchBarSection {
  placeholder: string;
  showFilters?: boolean;
}

export interface ContentBlock {
  id: string;
  type: 'hero' | 'stats' | 'panel' | 'search' | 'text' | 'feature' | 'cta';
  props: Record<string, any>;
}

export interface PageContent {
  id: string;
  name: string;
  path: string;
  blocks: ContentBlock[];
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
}

export interface DashboardContent extends PageContent {
  blocks: Array<ContentBlock & { type: 'hero' | 'stats' | 'panel' }>;
}

export interface SearchContent extends PageContent {
  blocks: Array<ContentBlock & { type: 'hero' | 'search' }>;
}

export interface ActivityContent extends PageContent {
  blocks: Array<ContentBlock & { type: 'hero' | 'text' }>;
}

export interface SettingsContent extends PageContent {
  blocks: Array<ContentBlock & { type: 'hero' | 'text' | 'feature' }>;
}

export interface PuckEditorConfig {
  components: Record<string, {
    render: (props: any) => React.ReactNode;
    fields?: Record<string, any>;
    defaultProps?: Record<string, any>;
  }>;
  root?: {
    render: (props: any) => React.ReactNode;
    fields?: Record<string, any>;
  };
}
