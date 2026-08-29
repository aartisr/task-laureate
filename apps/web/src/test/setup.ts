import { beforeEach } from 'vitest';

class TestDragEvent extends Event {
  dataTransfer: DataTransfer | null = null;
}

Object.defineProperty(globalThis, 'DragEvent', { configurable: true, value: TestDragEvent });
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

beforeEach(() => {
  document.documentElement.lang = 'en';
  document.head.innerHTML = '<meta name="viewport" content="width=device-width, initial-scale=1">';
  document.body.innerHTML = '<div id="root"><div data-testid="test-app-shell"></div></div>';
});
