import React, { useState } from 'react';

function generateIcsCalendarEvent(task: { title: string; description?: string; notes?: string; dueDate?: string }) {
  const dateStr = task.dueDate ? new Date(task.dueDate).toISOString().replace(/-|:|\.\d+/g, '') : new Date().toISOString().replace(/-|:|\.\d+/g, '');
  const details = task.notes || task.description || '';
  return [
    'BEGIN:VEVENT',
    `SUMMARY:${task.title}`,
    `DESCRIPTION:${details}`,
    `DTSTART:${dateStr}`,
    `DTEND:${dateStr}`,
    'END:VEVENT',
  ].join('\r\n');
}

interface EcosystemIntegrationsPanelProps {
  tasks?: Array<{
    id: string;
    title: string;
    notes?: string;
    description?: string;
    dueDate?: string;
    priority?: string;
    status?: string;
  }>;
  listTitle?: string;
  onImportTasks?: (importedTasks: Array<{ title: string; notes?: string; dueDate?: string; priority?: string }>) => void;
}

export function EcosystemIntegrationsPanel({
  tasks = [],
  listTitle = 'Workspace Tasks',
  onImportTasks,
}: EcosystemIntegrationsPanelProps) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'notion' | 'todoist' | 'api'>('calendar');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importCount, setImportCount] = useState<number | null>(null);

  // --- Calendar Export (.ics) ---
  const handleExportIcs = () => {
    if (tasks.length === 0) {
      alert('No tasks available to export.');
      return;
    }
    const calendarHeader = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Task Laureate//Ecosystem Sync//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ].join('\r\n');

    const calendarFooter = '\r\nEND:VCALENDAR';

    const events = tasks
      .filter((t) => t.dueDate)
      .map((t) => generateIcsCalendarEvent(t))
      .filter(Boolean)
      .join('\r\n');

    if (!events) {
      alert('None of the selected tasks have due dates scheduled for calendar export.');
      return;
    }

    const blob = new Blob([`${calendarHeader}\r\n${events}${calendarFooter}`], {
      type: 'text/calendar;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${listTitle.toLowerCase().replace(/\s+/g, '_')}_calendar.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Notion / CSV Export ---
  const handleExportNotionCsv = () => {
    if (tasks.length === 0) {
      alert('No tasks to export.');
      return;
    }
    const headers = ['Task Name', 'Status', 'Priority', 'Due Date', 'Notes'];
    const rows = tasks.map((t) => [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${t.status || 'todo'}"`,
      `"${t.priority || 'medium'}"`,
      `"${t.dueDate || ''}"`,
      `"${(t.notes || t.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `${listTitle.toLowerCase().replace(/\s+/g, '_')}_notion_export.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Todoist Export ---
  const handleExportTodoistCsv = () => {
    if (tasks.length === 0) {
      alert('No tasks to export.');
      return;
    }
    const headers = ['TYPE', 'CONTENT', 'DESCRIPTION', 'PRIORITY', 'DUE_DATE'];
    const rows = tasks.map((t) => [
      'task',
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.notes || t.description || '').replace(/"/g, '""')}"`,
      t.priority === 'high' ? '4' : t.priority === 'low' ? '1' : '2',
      `"${t.dueDate || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `${listTitle.toLowerCase().replace(/\s+/g, '_')}_todoist_export.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- File Import (Notion / Todoist / CSV) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
        if (lines.length < 2) {
          setImportStatus('CSV file appears empty or missing header row.');
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"/, '').replace(/"$/, '').toLowerCase());
        const titleIndex = headers.findIndex((h) => h.includes('title') || h.includes('name') || h.includes('content') || h.includes('task'));
        const descIndex = headers.findIndex((h) => h.includes('desc') || h.includes('detail') || h.includes('notes'));
        const dateIndex = headers.findIndex((h) => h.includes('due') || h.includes('date'));
        const priorityIndex = headers.findIndex((h) => h.includes('prio'));

        const parsedTasks: Array<{ title: string; notes?: string; dueDate?: string; priority?: string }> = [];

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map((cell) => cell.trim().replace(/^"/, '').replace(/"$/, ''));
          const title = titleIndex >= 0 ? row[titleIndex] : row[0];
          if (title) {
            parsedTasks.push({
              title,
              notes: descIndex >= 0 ? row[descIndex] : undefined,
              dueDate: dateIndex >= 0 ? row[dateIndex] : undefined,
              priority: priorityIndex >= 0 ? row[priorityIndex]?.toLowerCase() : 'medium',
            });
          }
        }

        if (parsedTasks.length > 0 && onImportTasks) {
          onImportTasks(parsedTasks);
          setImportCount(parsedTasks.length);
          setImportStatus(`Successfully imported ${parsedTasks.length} tasks into workspace!`);
        } else {
          setImportStatus('Could not find valid task titles in CSV file.');
        }
      } catch (err: any) {
        setImportStatus(`Error parsing CSV file: ${err.message || 'Invalid format'}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-default)', paddingBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Ecosystem &amp; Calendar Integrations
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Seamlessly sync and export tasks across Google Calendar, Notion, Todoist, and external webhooks.
          </p>
        </div>
      </header>

      {/* Navigation tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border-default)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          style={{
            padding: '0.5rem 0.85rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'calendar' ? '2px solid var(--color-action-primary)' : '2px solid transparent',
            color: activeTab === 'calendar' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            fontWeight: activeTab === 'calendar' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          📅 Google Calendar &amp; iCal
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notion')}
          style={{
            padding: '0.5rem 0.85rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'notion' ? '2px solid var(--color-action-primary)' : '2px solid transparent',
            color: activeTab === 'notion' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            fontWeight: activeTab === 'notion' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          📝 Notion Integration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('todoist')}
          style={{
            padding: '0.5rem 0.85rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'todoist' ? '2px solid var(--color-action-primary)' : '2px solid transparent',
            color: activeTab === 'todoist' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            fontWeight: activeTab === 'todoist' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          🔴 Todoist Sync
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('api')}
          style={{
            padding: '0.5rem 0.85rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'api' ? '2px solid var(--color-action-primary)' : '2px solid transparent',
            color: activeTab === 'api' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            fontWeight: activeTab === 'api' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          ⚡ Webhooks &amp; API
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
            Sync your Task Laureate schedule with Google Calendar, Apple Calendar, or Outlook using standard iCal `.ics` subscription feeds or 1-click downloads.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="primary-button"
              onClick={handleExportIcs}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              📅 Download iCal / Google Calendar (.ics)
            </button>
          </div>
        </div>
      )}

      {activeTab === 'notion' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
            Import your existing Notion database tasks or export your Task Laureate lists directly into Notion CSV database tables.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="primary-button"
              onClick={handleExportNotionCsv}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              📥 Export to Notion CSV
            </button>
            <label
              className="secondary-button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
            >
              📤 Import Notion / CSV File
              <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
          {importStatus && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: importCount ? 'var(--color-bg-secondary)' : 'var(--color-bg-tertiary)',
                color: importCount ? 'var(--color-status-success)' : 'var(--color-status-error)',
                fontSize: '0.85rem',
              }}
            >
              {importStatus}
            </div>
          )}
        </div>
      )}

      {activeTab === 'todoist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
            Migrate seamlessly between Todoist and Task Laureate. Export formatted CSV files ready for Todoist import or upload your Todoist backup.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="primary-button"
              onClick={handleExportTodoistCsv}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              📥 Export Todoist CSV
            </button>
            <label
              className="secondary-button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
            >
              📤 Import Todoist Backup (.csv)
              <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      )}

      {activeTab === 'api' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
            Connect Task Laureate with Zapier, Make, or custom API webhooks using JSON payloads.
          </p>
          <div style={{ background: 'var(--color-bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.8rem', overflowX: 'auto' }}>
            <pre style={{ margin: 0 }}>
{`// Example Task Laureate JSON Export / Webhook Schema:
{
  "workspace": "${listTitle}",
  "totalTasks": ${tasks.length},
  "tasks": ${JSON.stringify(tasks.slice(0, 2), null, 2)}
}`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
