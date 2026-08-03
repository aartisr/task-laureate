import { useEffect, useRef, type ClipboardEvent } from 'react';
import { noteHtmlForRender, noteOutline, normalizeNoteForStorage, sanitizeNoteHtml } from '../core/domain/richNote';

export function RichNoteReader({ value }: { value: string }) {
  const outline = noteOutline(value);
  return <div className="rich-note-reader">
    {outline.length >= 2 ? <nav className="rich-note-reader__outline" aria-label="On this page">
      <span>On this page</span>
      {outline.map((heading) => <a key={heading.id} className={`rich-note-reader__outline-link rich-note-reader__outline-link--${heading.level}`} href={`#${heading.id}`}>{heading.text}</a>)}
    </nav> : null}
    <div className="rich-note-reader__content" dangerouslySetInnerHTML={{ __html: noteHtmlForRender(value) }} />
  </div>;
}

export function RichNoteEditor({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef<string | null>(null);
  useEffect(() => {
    if (editorRef.current && value !== lastValue.current) editorRef.current.innerHTML = noteHtmlForRender(value);
    lastValue.current = value;
  }, [value]);

  const commit = () => {
    const html = normalizeNoteForStorage(editorRef.current?.innerHTML ?? '');
    lastValue.current = html;
    onChange(html);
  };

  const paste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, html ? sanitizeNoteHtml(html) : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>'));
    commit();
  };

  return <div className="rich-note-editor">
    <div className="rich-note-editor__toolbar" role="group" aria-label="Note formatting">
      <button type="button" onMouseDown={(event) => { event.preventDefault(); document.execCommand('bold'); }} disabled={disabled}><strong>B</strong><span className="sr-only">Bold</span></button>
      <button type="button" onMouseDown={(event) => { event.preventDefault(); document.execCommand('italic'); }} disabled={disabled}><em>I</em><span className="sr-only">Italic</span></button>
      <button type="button" onMouseDown={(event) => { event.preventDefault(); document.execCommand('insertUnorderedList'); }} disabled={disabled}>• List</button>
      <button type="button" onMouseDown={(event) => { event.preventDefault(); document.execCommand('formatBlock', false, 'h2'); }} disabled={disabled}>Heading</button>
    </div>
    <div
      ref={editorRef}
      className="rich-note-editor__surface"
      contentEditable={!disabled}
      role="textbox"
      aria-multiline="true"
      aria-label="Task note"
      data-placeholder="Add context, decisions, links, or a full working document…"
      suppressContentEditableWarning
      onInput={commit}
      onPaste={paste}
    />
  </div>;
}
