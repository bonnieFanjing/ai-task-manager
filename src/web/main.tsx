import { Check, Inbox, ListChecks, Plus, Sparkles } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

interface InboxItem {
  id: string;
  raw_text: string;
  source: string;
  status: string;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  deadline_at: string | null;
  estimated_minutes: number | null;
}

interface Recommendation {
  task: Task;
  score: number;
  reasons: string[];
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options?.headers ?? {})
    }
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function App() {
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [input, setInput] = useState('');
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [deadlineAt, setDeadlineAt] = useState('');
  const [message, setMessage] = useState('');

  const selectedInbox = useMemo(
    () => inboxItems.find((item) => item.id === selectedInboxId) ?? null,
    [inboxItems, selectedInboxId]
  );

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const [inbox, today] = await Promise.all([
      api<{ items: InboxItem[] }>('/api/inbox'),
      api<{ tasks: Task[] }>('/api/tasks/today')
    ]);
    setInboxItems(inbox.items);
    setTodayTasks(today.tasks);
  }

  async function addInbox(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    await api('/api/inbox', {
      method: 'POST',
      body: JSON.stringify({ rawText: input, source: 'web' })
    });
    setInput('');
    setMessage('Captured to Inbox');
    await refresh();
  }

  async function convertSelected(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedInbox) return;
    await api(`/api/inbox/${selectedInbox.id}/convert`, {
      method: 'POST',
      body: JSON.stringify({
        task: {
          title: taskTitle || selectedInbox.raw_text,
          status: deadlineAt ? 'scheduled' : 'next',
          deadlineAt: deadlineAt || null,
          reminderAt: deadlineAt || null,
          priority: 'medium',
          importance: 3,
          urgency: deadlineAt ? 4 : 3
        },
        createdBy: 'web'
      })
    });
    setSelectedInboxId(null);
    setTaskTitle('');
    setDeadlineAt('');
    setMessage('Converted to task');
    await refresh();
  }

  async function completeTask(taskId: string) {
    await api(`/api/tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ createdBy: 'web' })
    });
    setMessage('Task completed');
    await refresh();
  }

  async function getRecommendations() {
    const response = await api<{ recommendations: Recommendation[] }>('/api/recommendations/now', {
      method: 'POST',
      body: JSON.stringify({
        context: {
          onCommute: false,
          hasComputer: true,
          availableMinutes: 45,
          currentLocation: 'home'
        }
      })
    });
    setRecommendations(response.recommendations.slice(0, 5));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>AI Task Manager</h1>
          <p>Local-first task capture and planning</p>
        </div>
        <button className="icon-button" type="button" onClick={() => void refresh()} title="Refresh">
          <ListChecks size={18} />
        </button>
      </header>

      {message ? <div className="status-line">{message}</div> : null}

      <section className="workspace">
        <div className="panel inbox-panel">
          <div className="panel-heading">
            <Inbox size={19} />
            <h2>Inbox</h2>
          </div>
          <form className="capture-form" onSubmit={(event) => void addInbox(event)}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type a thought, task, reminder, or unfinished idea"
              rows={3}
            />
            <button type="submit">
              <Plus size={17} />
              Add
            </button>
          </form>
          <ul className="inbox-list">
            {inboxItems.map((item) => (
              <li key={item.id}>
                <button
                  className={item.id === selectedInboxId ? 'selected item-button' : 'item-button'}
                  type="button"
                  onClick={() => {
                    setSelectedInboxId(item.id);
                    setTaskTitle(item.raw_text);
                  }}
                >
                  <span>{item.raw_text}</span>
                  <small>{new Date(item.created_at).toLocaleString()}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <Check size={19} />
            <h2>Process</h2>
          </div>
          {selectedInbox ? (
            <form className="process-form" onSubmit={(event) => void convertSelected(event)}>
              <label>
                Task title
                <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
              </label>
              <label>
                Deadline / reminder
                <input
                  type="datetime-local"
                  value={deadlineAt}
                  onChange={(event) => setDeadlineAt(event.target.value)}
                />
              </label>
              <button type="submit">
                <Check size={17} />
                Convert
              </button>
            </form>
          ) : (
            <p className="empty-state">Select an Inbox item to process.</p>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <ListChecks size={19} />
            <h2>Today</h2>
          </div>
          <ul className="task-list">
            {todayTasks.map((task) => (
              <li key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <small>{task.deadline_at ?? 'No deadline'}</small>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  title="Complete"
                  onClick={() => void completeTask(task.id)}
                >
                  <Check size={17} />
                </button>
              </li>
            ))}
          </ul>
          {todayTasks.length === 0 ? <p className="empty-state">No active deadlines for today.</p> : null}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <Sparkles size={19} />
            <h2>Recommend</h2>
          </div>
          <button type="button" onClick={() => void getRecommendations()}>
            <Sparkles size={17} />
            What should I do now?
          </button>
          <ul className="recommendation-list">
            {recommendations.map((item) => (
              <li key={item.task.id}>
                <strong>{item.task.title}</strong>
                <small>{item.reasons.join('; ')}</small>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
