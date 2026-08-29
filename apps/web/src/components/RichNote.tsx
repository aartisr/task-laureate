import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { noteHtmlForRender, noteOutline, normalizeNoteForStorage, sanitizeNoteHtml } from '../core/domain/richNote';
import { AppIcon } from './AppIcon';

export function RichNoteReader({ value }: { value: string }) {
  const outline = noteOutline(value);

  const handleCopyCode = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  return (
    <div className="rich-note-reader">
      {outline.length >= 2 ? (
        <nav className="rich-note-reader__outline" aria-label="On this page">
          <div className="rich-note-reader__outline-title">
            <AppIcon name="list" size="14" />
            <span>Contents</span>
          </div>
          <div className="rich-note-reader__outline-links">
            {outline.map((heading) => (
              <a
                key={heading.id}
                className={`rich-note-reader__outline-link rich-note-reader__outline-link--${heading.level}`}
                href={`#${heading.id}`}
              >
                {heading.text}
              </a>
            ))}
          </div>
        </nav>
      ) : null}
      <div
        className="rich-note-reader__content"
        dangerouslySetInnerHTML={{ __html: noteHtmlForRender(value) }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const pre = target.closest('pre');
          if (pre && target.classList.contains('copy-code-btn')) {
            const code = pre.querySelector('code')?.innerText || pre.innerText;
            handleCopyCode(code);
          }
        }}
      />
    </div>
  );
}

export function RichNoteEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef<string | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (editorRef.current && value !== lastValue.current) {
      editorRef.current.innerHTML = noteHtmlForRender(value);
    }
    lastValue.current = value;
  }, [value]);

  const commit = () => {
    const html = normalizeNoteForStorage(editorRef.current?.innerHTML ?? '');
    lastValue.current = html;
    onChange(html);
    updateActiveFormats();
  };

  const updateActiveFormats = () => {
    if (typeof document === 'undefined') return;
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        strikethrough: document.queryCommandState('strikethrough'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      });
    } catch {
      // Ignored if selection not in editor
    }
  };

  const executeCommand = (command: string, valueArgument: string | undefined = undefined) => {
    if (disabled) return;
    document.execCommand(command, false, valueArgument);
    commit();
  };

  const handleFormatBlock = (tag: string) => {
    if (disabled) return;
    document.execCommand('formatBlock', false, `<${tag}>`);
    commit();
  };

  const handleInsertLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) {
      setShowLinkInput(false);
      return;
    }
    const formattedUrl = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    executeCommand('createLink', formattedUrl);
    setLinkUrl('');
    setShowLinkInput(false);
  };

  const paste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    document.execCommand(
      'insertHTML',
      false,
      html
        ? sanitizeNoteHtml(html)
        : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
    );
    commit();
  };

  return (
    <div className="rich-note-editor">
      <div className="rich-note-editor__toolbar" role="toolbar" aria-label="Rich note controls">
        <div className="rich-note-editor__group">
          <button
            type="button"
            className={`rich-note-editor__btn ${activeFormats.bold ? 'is-active' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('bold');
            }}
            disabled={disabled}
            title="Bold (⌘B)"
            aria-label="Bold"
          >
            <AppIcon name="bold" size="15" />
          </button>
          <button
            type="button"
            className={`rich-note-editor__btn ${activeFormats.italic ? 'is-active' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('italic');
            }}
            disabled={disabled}
            title="Italic (⌘I)"
            aria-label="Italic"
          >
            <AppIcon name="italic" size="15" />
          </button>
        </div>

        <div className="rich-note-editor__divider" />

        <div className="rich-note-editor__group">
          <button
            type="button"
            className="rich-note-editor__btn"
            onMouseDown={(e) => {
              e.preventDefault();
              handleFormatBlock('h2');
            }}
            disabled={disabled}
            title="Heading 1"
            aria-label="Heading 1"
          >
            <span className="rich-note-editor__text-icon">H1</span>
          </button>
          <button
            type="button"
            className="rich-note-editor__btn"
            onMouseDown={(e) => {
              e.preventDefault();
              handleFormatBlock('h3');
            }}
            disabled={disabled}
            title="Heading 2"
            aria-label="Heading 2"
          >
            <span className="rich-note-editor__text-icon">H2</span>
          </button>
          <button
            type="button"
            className="rich-note-editor__btn"
            onMouseDown={(e) => {
              e.preventDefault();
              handleFormatBlock('p');
            }}
            disabled={disabled}
            title="Paragraph"
            aria-label="Paragraph"
          >
            <span className="rich-note-editor__text-icon">P</span>
          </button>
        </div>

        <div className="rich-note-editor__divider" />

        <div className="rich-note-editor__group">
          <button
            type="button"
            className={`rich-note-editor__btn ${activeFormats.insertUnorderedList ? 'is-active' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('insertUnorderedList');
            }}
            disabled={disabled}
            title="Bullet List"
            aria-label="Bullet List"
          >
            <AppIcon name="list" size="15" />
          </button>
          <button
            type="button"
            className={`rich-note-editor__btn ${activeFormats.insertOrderedList ? 'is-active' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('insertOrderedList');
            }}
            disabled={disabled}
            title="Numbered List"
            aria-label="Numbered List"
          >
            <span className="rich-note-editor__text-icon">1.</span>
          </button>
          <button
            type="button"
            className="rich-note-editor__btn"
            onMouseDown={(e) => {
              e.preventDefault();
              handleFormatBlock('blockquote');
            }}
            disabled={disabled}
            title="Quote"
            aria-label="Quote"
          >
            <AppIcon name="quote" size="15" />
          </button>
          <button
            type="button"
            className="rich-note-editor__btn"
            onMouseDown={(e) => {
              e.preventDefault();
              handleFormatBlock('pre');
            }}
            disabled={disabled}
            title="Code Block"
            aria-label="Code Block"
          >
            <AppIcon name="code" size="15" />
          </button>
        </div>

        <div className="rich-note-editor__divider" />

        <div className="rich-note-editor__group">
          <button
            type="button"
            className="rich-note-editor__btn"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowLinkInput(!showLinkInput);
            }}
            disabled={disabled}
            title="Insert Link"
            aria-label="Insert Link"
          >
            <AppIcon name="link" size="15" />
          </button>
          <button
            type="button"
            className="rich-note-editor__btn"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('insertHorizontalRule');
            }}
            disabled={disabled}
            title="Divider Line"
            aria-label="Divider Line"
          >
            <AppIcon name="minus" size="15" />
          </button>
          <button
            type="button"
            className="rich-note-editor__btn"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('removeFormat');
            }}
            disabled={disabled}
            title="Clear Formatting"
            aria-label="Clear Formatting"
          >
            <AppIcon name="undo" size="14" />
          </button>
        </div>
      </div>

      {showLinkInput ? (
        <form className="rich-note-editor__link-form" onSubmit={handleInsertLink}>
          <AppIcon name="link" size="14" className="text-tertiary" />
          <input
            type="url"
            placeholder="Paste or type URL (https://...)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            autoFocus
          />
          <button type="submit" className="primary-button density-compact">
            Apply
          </button>
          <button
            type="button"
            className="secondary-button density-compact"
            onClick={() => setShowLinkInput(false)}
          >
            Cancel
          </button>
        </form>
      ) : null}

      <div
        ref={editorRef}
        className="rich-note-editor__surface"
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        aria-label="Task note"
        data-placeholder="Write notes, decisions, links, sub-tasks, or type markdown..."
        suppressContentEditableWarning
        onInput={commit}
        onKeyUp={updateActiveFormats}
        onMouseUp={updateActiveFormats}
        onPaste={paste}
      />
    </div>
  );
}
