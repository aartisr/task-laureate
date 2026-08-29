import type { QueryClient } from '@tanstack/react-query';
import type { ActivityEvent, ListTemplate, SearchResult, TodoItem, TodoList } from './domain';
import type { TodoRepository } from './repository';

export interface FeatureContext {
  repository: TodoRepository;
  queryClient: QueryClient;
  now: () => Date;
}

export interface NavItem {
  label: string;
  to: string;
  icon?: string;
  description?: string;
}

export interface CommandDefinition {
  id: string;
  label: string;
  shortcut?: string;
  run: (context: FeatureContext) => Promise<void> | void;
}

export interface QueryDefinition<TResult = unknown> {
  id: string;
  select?: (context: FeatureContext) => Promise<TResult> | TResult;
}

export interface ActionDefinition {
  id: string;
  label: string;
  run: (context: FeatureContext) => Promise<void> | void;
}

export interface PanelDefinition {
  id: string;
  label: string;
}

export interface RouteDefinition {
  id: string;
  path: string;
  label: string;
}

export interface FeatureModule {
  id: string;
  routes?: RouteDefinition[];
  commands?: CommandDefinition[];
  queries?: QueryDefinition[];
  actions?: ActionDefinition[];
  navItems?: NavItem[];
  panels?: PanelDefinition[];
  init?: (context: FeatureContext) => void;
}

export type FeatureDataShape = {
  lists: TodoList[];
  tasks: TodoItem[];
  activity: ActivityEvent[];
  templates: ListTemplate[];
  search: SearchResult[];
};
