/**
 * PostHog client singleton.
 *
 * Manages a lazily-initialized PostHog instance. The actual SDK import and
 * initialization live in posthogSink.ts. This module is purely a state store
 * (cache + guards) so it has zero posthog-js module dependencies and compiles
 * cleanly before `npm install` is run.
 *
 * Self-hosted PostHog: set VITE_POSTHOG_HOST to your instance URL.
 * PostHog EU Cloud:    set VITE_POSTHOG_HOST to https://eu.i.posthog.com
 */

import type { AnalyticsConfig } from './analyticsConfig';

// Minimal structural type for the PostHog SDK – compatible with the real posthog-js API.
// posthogSink.ts holds the real import type and verifies structural compatibility.
export interface PostHogLike {
  init(token: string, config?: Record<string, unknown>): void;
  capture(event: string, properties?: Record<string, unknown>): void;
  identify(distinctId: string, properties?: Record<string, unknown>): void;
  reset(resetDeviceId?: boolean): void;
  opt_in_capturing(): void;
  opt_out_capturing(): void;
  has_opted_out_capturing(): boolean;
  get_distinct_id(): string;
  [key: string]: unknown;
}

let _instance: PostHogLike | null = null;
let _initPromise: Promise<PostHogLike | null> | null = null;

function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isLocalhostOrTest(): boolean {
  if (!isBrowserEnvironment()) return true;
  const { hostname } = window.location;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    hostname === ''
  );
}

export function shouldInitPostHog(config: AnalyticsConfig): boolean {
  if (!config.isValid) return false;
  if (!isBrowserEnvironment()) return false;
  if (isLocalhostOrTest() && import.meta.env.VITE_POSTHOG_FORCE_LOCAL !== 'true') return false;
  return true;
}

export function getCachedPostHogInstance(): PostHogLike | null {
  return _instance;
}

export function setCachedPostHogInstance(instance: PostHogLike): void {
  _instance = instance;
}

export function getInitPromise(): Promise<PostHogLike | null> | null {
  return _initPromise;
}

export function setInitPromise(p: Promise<PostHogLike | null>): void {
  _initPromise = p;
}

export function clearInitPromise(): void {
  _initPromise = null;
}

/** Reset the singleton – called between tests only */
export function _resetPostHogClientForTest(): void {
  _instance = null;
  _initPromise = null;
}
