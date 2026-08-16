import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { requestListCreation, useListCreationCommand } from './useListCreationCommand';

function Harness() {
  const [opened, setOpened] = useState(false);
  useListCreationCommand(() => setOpened(true));
  return <output>{opened ? 'opened' : 'closed'}</output>;
}

describe('useListCreationCommand', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    window.sessionStorage.clear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('opens an already-mounted composer when navigation requests a new List', async () => {
    await act(async () => root.render(<Harness />));
    expect(host.textContent).toBe('closed');

    await act(async () => requestListCreation());
    expect(host.textContent).toBe('opened');
  });

  it('preserves a request made before the Dashboard listener mounts', async () => {
    await act(async () => requestListCreation());
    await act(async () => root.render(<Harness />));

    expect(host.textContent).toBe('opened');
  });
});
