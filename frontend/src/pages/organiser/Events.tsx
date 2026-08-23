import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Calendar } from 'lucide-react';
import { organiserApi } from '../../api';

const EVENT_TYPES = [
  'movie','concert','play','musical','opera','dance','standup','sports',
  'esports','festival','exhibition','conference','workshop','magic','circus','other'
];

export default function OrganiserEvents() {
  const qc = useQueryClient();
  const { data: events = [], isLoading } = useQuery({ queryKey: ['organiser-events'], queryFn: organiserApi.getEvents });
  const { data: venues = [] } = useQuery({ queryKey: ['organiser-venues'], queryFn: organiserApi.getVenues });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'concert', venue_id: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await organiserApi.createEvent(form);
      setForm({ title: '', type: 'concert', venue_id: '', description: '' });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['organiser-events'] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to create event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Events</h1>
        <button id="create-event-btn" onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm">
          <Plus size={14} />
          Create Event
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="glass rounded-2xl p-5 border border-amber-500/25 mb-6 animate-slide-up">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">New Event</h2>
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm mb-3">
              {error}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <input id="event-title" type="text" required className="input" placeholder="Event title"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select id="event-type" required className="input" value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <select id="event-venue" required className="input" value={form.venue_id}
              onChange={(e) => setForm({ ...form, venue_id: e.target.value })}>
              <option value="">Select venue…</option>
              {(venues as Record<string, unknown>[]).map((v) => (
                <option key={v.id as string} value={v.id as string}>{v.name as string} — {v.city as string}</option>
              ))}
            </select>
            <textarea id="event-desc" className="input" rows={2} placeholder="Description (optional)"
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Creating…' : 'Create Event'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
      ) : (events as Record<string, unknown>[]).length === 0 ? (
        <div className="text-center py-12">
          <Calendar size={40} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No events yet. Create your first event!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(events as Record<string, unknown>[]).map((e) => (
            <Link key={e.id as string} to={`/organiser/events/${e.id}`}
              className="glass rounded-xl p-4 border border-amber-500/15 flex items-center justify-between card-hover block">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{e.title as string}</p>
                <p className="text-xs text-slate-500 capitalize">{e.type as string} · {e.venue_name as string}, {e.city as string}</p>
              </div>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{e.show_count as number} show{Number(e.show_count) !== 1 ? 's' : ''}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
