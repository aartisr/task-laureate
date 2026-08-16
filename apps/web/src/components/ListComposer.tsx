import { type FormEvent, type RefObject, useState } from 'react';
import type { TodoListInput } from '../core/contracts/repository';

export function ListComposer({ onCreate, onCancel, titleInputRef, initialInput, restoredDraft = false }: {
  onCreate: (input: TodoListInput) => Promise<void>;
  onCancel: () => void;
  titleInputRef?: RefObject<HTMLInputElement>;
  initialInput?: Pick<TodoListInput, 'title' | 'description'>;
  restoredDraft?: boolean;
}) {
  const [title, setTitle] = useState(initialInput?.title ?? '');
  const [description, setDescription] = useState(initialInput?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await onCreate({ title: title.trim(), description: description.trim() || undefined });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not create this list. Please try again.');
      setSaving(false);
    }
  };

  return <form className="list-composer" onSubmit={(event) => void submit(event)} aria-label="Create a new list">
    <div className="list-composer__heading"><p className="eyebrow">New private list</p><h2>Name it. Start moving.</h2><p>One name is enough. You can add tasks and refine the details next.</p>{restoredDraft ? <p className="list-composer__restored" role="status">Your draft was restored. Review it, then create your private list.</p> : null}</div>
    <label className="list-composer__title" htmlFor="list-composer-title">What are you organizing?<input id="list-composer-title" ref={titleInputRef} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Spring launch" autoComplete="off" enterKeyHint="go" maxLength={255} required /><small>Press Enter to create and add your first task.</small></label>
    <details className="list-composer__details"><summary>Add context <span>(optional)</span></summary><label htmlFor="list-composer-description">Description<textarea id="list-composer-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A sentence to help future you." maxLength={1000} rows={2} /></label></details>
    {error ? <p className="list-composer__error" role="alert">{error}</p> : null}
    <div className="list-composer__actions"><button className="primary-button" type="submit" disabled={!title.trim() || saving}>{saving ? 'Creating…' : 'Create & add tasks'} <span aria-hidden="true">→</span></button><button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>Cancel</button></div>
  </form>;
}
