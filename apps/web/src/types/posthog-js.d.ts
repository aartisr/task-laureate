/**
 * Minimal posthog-js type stub.
 *
 * This file provides just enough types for the analytics infrastructure to
 * compile before `posthog-js` is installed. Once `npm install` runs and the
 * real package is present in node_modules, TypeScript will prefer the official
 * declarations and this stub can be removed.
 *
 * @see https://posthog.com/docs/libraries/js
 */

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
