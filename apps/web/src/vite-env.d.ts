/// <reference types="vite/client" />

// ---------------------------------------------------------------------------
// posthog-js type stub
// Provides compile-time types before `npm install` installs the real package.
// Once posthog-js is present in node_modules its own types take precedence
// because TypeScript prefers node_modules over ambient declarations.
// ---------------------------------------------------------------------------
declare module 'posthog-js' {
  export interface PostHogConfig {
    api_host?: string;
    autocapture?: boolean;
    capture_pageview?: boolean;
    capture_pageleave?: boolean;
    capture_exceptions?: boolean;
    disable_session_recording?: boolean;
    person_profiles?: 'always' | 'identified_only' | 'never';
    opt_out_capturing_by_default?: boolean;
    persistence?: 'localStorage' | 'sessionStorage' | 'memory' | 'cookie' | 'localStorage+cookie';
    loaded?: (posthog: PostHog) => void;
    [key: string]: unknown;
  }

  export interface PostHog {
    init(token: string, config?: PostHogConfig): void;
    capture(event: string, properties?: Record<string, unknown>): void;
    identify(distinctId: string, properties?: Record<string, unknown>): void;
    reset(resetDeviceId?: boolean): void;
    opt_in_capturing(): void;
    opt_out_capturing(): void;
    has_opted_out_capturing(): boolean;
    get_distinct_id(): string;
    [key: string]: unknown;
  }

  const posthog: PostHog;
  export default posthog;
}
