import { useEffect, useMemo, useState } from 'react';
import { defaultTaskReminderChannels, getTaskReminderSetup, requestTaskStatusUpdate, saveTaskReminder, setTaskAssignee, type TaskReminderConfiguration } from '../infrastructure/notifications/taskReminders';

type Candidate = { user_id: string; email: string; access_role: string };
const visibleReminderChannels = [
  { value: 'in_app' as const, label: 'In-app', detail: 'Private notification and browser alert when enabled.' },
  { value: 'email' as const, label: 'Email', detail: 'Send to the collaborator’s account email.' },
];

/** Owner-only control. Empty and failed setup states remain visible, so an
 * owner always receives a clear next step instead of a mysteriously absent UI. */
export function TaskReminderControl({ taskId }: { taskId: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [rule, setRule] = useState<TaskReminderConfiguration>({ enabled: false, offset_minutes: 1440, channels: defaultTaskReminderChannels });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [setupFailed, setSetupFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSetupFailed(false);
    void getTaskReminderSetup(taskId)
      .then((setup) => {
        if (!active) return;
        setCandidates(setup.candidates);
        setAssigned(setup.assigned);
        setRule(setup.rule);
      })
      .catch(() => { if (active) setSetupFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [taskId, reloadKey]);

  // The owner can never request an update from themselves. The RPC includes
  // that person in access candidates, so omit the impossible checkbox here.
  const collaborators = useMemo(() => candidates.filter((candidate) => candidate.access_role !== 'owner'), [candidates]);
  const assignedCollaboratorCount = collaborators.filter((candidate) => assigned.has(candidate.user_id)).length;
  const retrySetup = () => setReloadKey((current) => current + 1);
  const updateAssignee = async (userId: string, value: boolean) => {
    setSaving(true); setMessage('');
    try {
      await setTaskAssignee(taskId, userId, value);
      setAssigned((current) => { const next = new Set(current); value ? next.add(userId) : next.delete(userId); return next; });
    } catch { setMessage('We could not update this assignee. Please try again.'); }
    finally { setSaving(false); }
  };
  const saveRule = async (next: TaskReminderConfiguration) => {
    setSaving(true); setMessage('');
    try { await saveTaskReminder(taskId, next); setRule(next); setMessage(next.enabled ? 'Reminder schedule saved.' : 'Reminder paused.'); }
    catch { setMessage('We could not save this reminder schedule. Please try again.'); }
    finally { setSaving(false); }
  };
  const updateChannel = (channel: 'in_app' | 'email', enabled: boolean) => {
    const channels = enabled ? (rule.channels.includes(channel) ? rule.channels : [...rule.channels, channel]) : rule.channels.filter((item) => item !== channel);
    if (!channels.length) { setMessage('Choose at least one delivery channel.'); return; }
    void saveRule({ ...rule, channels });
  };
  const requestUpdate = async () => {
    setSaving(true); setMessage('');
    try {
      const result = await requestTaskStatusUpdate(taskId);
      if (result.alreadyRequested || result.requested === 0) setMessage('An update was already requested recently. You can ask again tomorrow.');
      else if (result.emailSent) setMessage(`Status update requested from ${result.requested} collaborator${result.requested === 1 ? '' : 's'}. Email sent where enabled.`);
      else setMessage(`Status update requested from ${result.requested} collaborator${result.requested === 1 ? '' : 's'}. They will see it in Task Laureate.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'We could not request a status update.'); }
    finally { setSaving(false); }
  };

  if (loading) return <section className="task-reminder-control" aria-busy="true"><h3>Assignment & reminders</h3><p>Loading collaboration settings…</p></section>;
  if (setupFailed) return <section className="task-reminder-control" aria-labelledby={`task-reminders-${taskId}`}><div><h3 id={`task-reminders-${taskId}`}>Assignment & reminders</h3><p>We could not load the people who can work on this task.</p></div><div className="task-reminder-control__status-request"><div><strong>Try again</strong><p>Your task and sharing settings are unchanged.</p></div><button type="button" className="secondary-button" onClick={retrySetup}>Retry</button></div></section>;
  if (!collaborators.length) return <section className="task-reminder-control" aria-labelledby={`task-reminders-${taskId}`}><div><h3 id={`task-reminders-${taskId}`}>Assignment & reminders</h3><p>Keep updates thoughtful and targeted.</p></div><div className="task-reminder-control__status-request"><div><strong>Share this List to request an update</strong><p>Invite a collaborator from the List’s Share panel. Once they accept, return here to assign them and request a status update.</p></div></div></section>;

  return <section className="task-reminder-control" aria-labelledby={`task-reminders-${taskId}`}><div><h3 id={`task-reminders-${taskId}`}>Assignment & reminders</h3><p>Assign people who have access, choose when to remind them, then select a private in-app alert or email.</p></div><div className="task-reminder-control__people">{collaborators.map((candidate) => <label key={candidate.user_id}><input type="checkbox" checked={assigned.has(candidate.user_id)} disabled={saving} onChange={(event) => void updateAssignee(candidate.user_id, event.target.checked)} /><span><strong>{candidate.email}</strong><small>{candidate.access_role === 'viewer' ? 'Read-only access' : 'Can update tasks'}</small></span></label>)}</div><section className="task-reminder-control__status-request" aria-label="Request a task update"><div><strong>Need an update now?</strong><p>Ask assigned collaborators to update this task. Each person receives at most one request per day.</p></div><button type="button" className="secondary-button" disabled={saving || !assignedCollaboratorCount} onClick={() => void requestUpdate()}>{saving ? 'Requesting…' : 'Request status update'}</button></section><div className="task-reminder-control__schedule"><label><input type="checkbox" checked={rule.enabled} disabled={saving || !assignedCollaboratorCount} onChange={(event) => void saveRule({ ...rule, enabled: event.target.checked })} /> Remind assignees</label><select aria-label="Reminder timing" disabled={saving || !rule.enabled} value={rule.offset_minutes} onChange={(event) => void saveRule({ ...rule, offset_minutes: Number(event.target.value) })}><option value={1440}>1 day before due date</option><option value={4320}>3 days before due date</option><option value={10080}>1 week before due date</option></select></div><fieldset className="task-reminder-control__channels" disabled={saving || !rule.enabled || !assignedCollaboratorCount}><legend>Send reminder by</legend>{visibleReminderChannels.map((channel) => <label key={channel.value}><input type="checkbox" checked={rule.channels.includes(channel.value)} onChange={(event) => updateChannel(channel.value, event.target.checked)} /><span><strong>{channel.label}</strong><small>{channel.detail}</small></span></label>)}</fieldset><p className="task-reminder-control__hint">Email is sent only when the assignee keeps email reminders enabled. Their personal settings stay private.</p>{!assignedCollaboratorCount ? <p className="task-reminder-control__hint">Assign at least one collaborator before requesting an update or enabling a reminder.</p> : null}{message ? <p className="task-reminder-control__hint" role="status">{message}</p> : null}</section>;
}
