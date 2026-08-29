/**
 * A deliberately small, portable rich-note boundary.
 *
 * Notes remain strings in the repository contract so existing browser and
 * Supabase snapshots continue to work. Strings containing markup are treated
 * as untrusted input and normalized through this module before persistence or
 * rendering. This is the single approved HTML boundary in the UI.
 */
export const MAX_NOTE_LENGTH = 250_000;

const ALLOWED_TAGS = new Set(['a', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'hr', 'img', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul']);
const ALLOWED_ATTRIBUTES = new Set(['alt', 'colspan', 'href', 'rowspan', 'src', 'target', 'title']);
const BLOCK_TAGS = new Set(['blockquote', 'div', 'h1', 'h2', 'h3', 'h4', 'li', 'p', 'pre', 'tr']);

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isSafeUrl(value: string, kind: 'link' | 'image') {
  try {
    const url = new URL(value, 'https://task-laureate.invalid');
    if (url.protocol === 'https:' || url.protocol === 'http:') return true;
    return kind === 'image' && url.protocol === 'data:' && value.startsWith('data:image/');
  } catch {
    return false;
  }
}

/** Returns safe, presentation-only HTML. Never bypass this with innerHTML. */
export function sanitizeNoteHtml(input: string) {
  const source = input.slice(0, MAX_NOTE_LENGTH);
  if (typeof DOMParser === 'undefined') return escapeHtml(source).replace(/\n/g, '<br>');
  const document = new DOMParser().parseFromString(source, 'text/html');
  const walk = (element: Element) => {
    [...element.children].forEach((child) => {
      if (!ALLOWED_TAGS.has(child.tagName.toLowerCase())) {
        const promotedElements = [...child.children];
        const fragment = document.createDocumentFragment();
        while (child.firstChild) fragment.append(child.firstChild);
        child.replaceWith(fragment);
        // An unsupported wrapper (for example SVG) must not become a way to
        // smuggle unsafe attributes onto otherwise allowed descendants.
        promotedElements.forEach(walk);
        return;
      }
      [...child.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const tag = child.tagName.toLowerCase();
        const allowed = ALLOWED_ATTRIBUTES.has(name)
          && !(name === 'href' && !isSafeUrl(attribute.value, 'link'))
          && !(name === 'src' && !isSafeUrl(attribute.value, 'image'))
          && !(name === 'src' && tag !== 'img');
        if (!allowed) child.removeAttribute(attribute.name);
      });
      const tag = child.tagName.toLowerCase();
      if (tag === 'a' && child.getAttribute('target') === '_blank') child.setAttribute('rel', 'noopener noreferrer');
      walk(child);
    });
  };
  // Unwrapping an unsupported element can promote new siblings. A bounded
  // second pass (ten levels is far beyond useful note structure) ensures those
  // promoted nodes receive the same attribute checks.
  for (let pass = 0; pass < 10; pass++) walk(document.body);
  return document.body.innerHTML;
}

export function isRichNote(note: string) {
  return /<\/?[a-z][\s\S]*>/i.test(note);
}

/** Plain text powers previews, search, reading time and accessible labels. */
export function noteToPlainText(note: string) {
  if (!note) return '';
  if (typeof DOMParser === 'undefined') return note.replace(/<[^>]+>/g, ' ');
  const document = new DOMParser().parseFromString(isRichNote(note) ? sanitizeNoteHtml(note) : escapeHtml(note).replace(/\n/g, '<br>'), 'text/html');
  document.querySelectorAll('br').forEach((element) => element.replaceWith(document.createTextNode(' ')));
  document.querySelectorAll([...BLOCK_TAGS].join(',')).forEach((element) => {
    element.before(document.createTextNode(' '));
    element.after(document.createTextNode(' '));
  });
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function notePreview(note: string, limit = 220) {
  const value = noteToPlainText(note);
  return value.length > limit ? `${value.slice(0, limit).trimEnd()}…` : value;
}

export interface NoteHeading { id: string; text: string; level: number; }

export function noteOutline(note: string): NoteHeading[] {
  if (!isRichNote(note) || typeof DOMParser === 'undefined') return [];
  const document = new DOMParser().parseFromString(sanitizeNoteHtml(note), 'text/html');
  return [...document.querySelectorAll('h1,h2,h3,h4')].map((heading, index) => ({
    id: `note-heading-${index + 1}`,
    text: heading.textContent?.trim() || `Section ${index + 1}`,
    level: Number(heading.tagName.slice(1)),
  }));
}

export function noteReadingMinutes(note: string) {
  const words = noteToPlainText(note).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

/** Adds stable anchor ids to headings in a safe rendered document. */
export function noteHtmlForRender(note: string) {
  const safe = isRichNote(note) ? sanitizeNoteHtml(note) : escapeHtml(note).replace(/\n/g, '<br>');
  if (typeof DOMParser === 'undefined') return safe;
  const document = new DOMParser().parseFromString(safe, 'text/html');
  [...document.querySelectorAll('h1,h2,h3,h4')].forEach((heading, index) => heading.id = `note-heading-${index + 1}`);
  return document.body.innerHTML;
}

export function normalizeNoteForStorage(note: string) {
  return isRichNote(note) ? sanitizeNoteHtml(note).slice(0, MAX_NOTE_LENGTH) : note.slice(0, MAX_NOTE_LENGTH);
}
