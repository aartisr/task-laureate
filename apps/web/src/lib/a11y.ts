/**
 * Accessibility utilities for WCAG 2.1 AA compliance
 */

/**
 * Generate unique IDs for ARIA relationships
 */
export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Announce messages to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

/**
 * Focus management helper
 */
export function focusElement(element: HTMLElement | null, options?: FocusOptions): void {
  if (element) {
    element.focus(options);
  }
}

/**
 * Check if element is visible and focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  const isVisible = getComputedStyle(element).display !== 'none' && 
                    getComputedStyle(element).visibility !== 'hidden';
  const isDisabled = element.hasAttribute('disabled');
  return isVisible && !isDisabled;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(container.querySelectorAll(focusableSelectors))
    .filter(el => isFocusable(el as HTMLElement)) as HTMLElement[];
}

/**
 * Trap focus within a container (useful for modals)
 */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement as HTMLElement;

  if (event.shiftKey) {
    if (activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    }
  } else {
    if (activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
}

/**
 * Skip links helper
 */
export function scrollToMain(): void {
  const mainContent = document.querySelector('main');
  if (mainContent) {
    mainContent.focus();
    mainContent.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * ARIA live region types
 */
export type AriaLiveRegion = 'polite' | 'assertive' | 'off';

/**
 * ARIA role types
 */
export type AriaRole = 
  | 'button' | 'link' | 'menuitem' | 'tab' | 'checkbox' | 'radio'
  | 'combobox' | 'listbox' | 'searchbox' | 'switch' | 'alert'
  | 'alertdialog' | 'dialog' | 'menu' | 'menubar' | 'tablist'
  | 'toolbar' | 'tooltip' | 'region' | 'main' | 'navigation'
  | 'search' | 'contentinfo' | 'banner' | 'complementary';

/**
 * Common ARIA attributes builder
 */
export interface AriaAttributes {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-live'?: AriaLiveRegion;
  'aria-busy'?: boolean;
  'aria-disabled'?: boolean;
  'aria-expanded'?: boolean;
  'aria-hidden'?: boolean;
  'aria-pressed'?: boolean;
  'aria-selected'?: boolean;
  'aria-checked'?: boolean | 'mixed';
  'aria-current'?: boolean | 'page' | 'step' | 'location' | 'date' | 'time';
  'aria-atomic'?: boolean;
  'aria-relevant'?: string;
  'aria-roledescription'?: string;
}

/**
 * Build ARIA attributes object
 */
export function buildAriaAttrs(attrs: Partial<AriaAttributes>): AriaAttributes {
  return attrs as AriaAttributes;
}

/**
 * Keyboard event helpers
 */
export const KEYS = {
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  SPACE: ' ',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
} as const;

export function isKey(event: KeyboardEvent, key: string): boolean {
  return event.key === key;
}

export function isPrintableKey(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey;
}
