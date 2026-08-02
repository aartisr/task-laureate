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
    <div className="list-composer__heading"><h2>Create a list</h2><p>Give this project or category a clear name. You can add tasks right after.</p>{restoredDraft ? <p className="list-composer__restored" role="status">Your draft was restored. Review it, then create your private list.</p> : null}</div>
    <label htmlFor="list-composer-title">List name<input id="list-composer-title" ref={titleInputRef} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Spring launch" autoComplete="off" maxLength={255} required /></label>
    <label htmlFor="list-composer-description">Description <span>(optional)</span><textarea id="list-composer-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What belongs in this list?" maxLength={1000} rows={2} /></label>
    {error ? <p className="list-composer__error" role="alert">{error}</p> : null}
    <div className="list-composer__actions"><button className="primary-button" type="submit" disabled={!title.trim() || saving}>{saving ? 'Creating…' : 'Create list'}</button><button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>Cancel</button></div>
  </form>;
}
