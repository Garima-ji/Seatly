import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle, XCircle, Calendar, DollarSign } from 'lucide-react';
import { organiserApi } from '../../api';
import { formatIST } from '../../utils/format';

export default function OrganiserEventDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['organiser-summary', id],
    queryFn: () => organiserApi.getSummary(id!),
    enabled: !!id,
  });

  const [showShowForm, setShowShowForm] = useState(false);
  const [showForm, setShowForm] = useState({ starts_at: '', ends_at: '' });
  const [savingShow, setSavingShow] = useState(false);

  const handleCreateShow = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingShow(true);
    try {
      await organiserApi.createShow(id!, {
        starts_at: new Date(showForm.starts_at).toISOString(),
        ends_at: new Date(showForm.ends_at).toISOString(),
      });
      setShowShowForm(false);
      qc.invalidateQueries({ queryKey: ['organiser-summary', id] });
    } catch { /* ignore */ }
    setSavingShow(false);
  };

  const handleStatusChange = async (showId: string, status: string) => {
    try {
      await organiserApi.updateShowStatus(showId, status);
      qc.invalidateQueries({ queryKey: ['organiser-summary', id] });
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Status update failed.');
    }
  };

  if (isLoading) return <div className="h-96 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;
  if (!data) return <p className="text-slate-500">Event not found.</p>;

  const { event, shows } = data;

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{event.title}</h1>
      <p className="text-sm text-slate-500 mb-6 capitalize">{event.type} · {event.venue_name}, {event.city}</p>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar size={16} className="text-amber-500" />
          Shows ({shows.length})
        </h2>
        <button id="add-show-btn" onClick={() => setShowShowForm(!showShowForm)} className="btn btn-primary btn-sm">
          <Plus size={14} />
          Add Show
        </button>
      </div>

      {showShowForm && (
        <form onSubmit={handleCreateShow} className="glass rounded-xl p-4 border border-amber-500/25 mb-4 animate-slide-up">
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Starts At (IST)</label>
              <input id="show-starts-at" type="datetime-local" required className="input"
                value={showForm.starts_at} onChange={(e) => setShowForm({ ...showForm, starts_at: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Ends At (IST)</label>
              <input id="show-ends-at" type="datetime-local" required className="input"
                value={showForm.ends_at} onChange={(e) => setShowForm({ ...showForm, ends_at: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={savingShow} className="btn btn-primary btn-sm">{savingShow ? 'Creating…' : 'Create Show'}</button>
            <button type="button" onClick={() => setShowShowForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {shows.map((show: Record<string, unknown>) => {
          const cats = (show.categories as Record<string, unknown>[]) ?? [];
          const totalRevenue = cats.reduce((sum, c) => sum + Number(c.revenue ?? 0), 0);
          const totalConfirmed = cats.reduce((sum, c) => sum + Number(c.confirmed_bookings ?? 0), 0);

          return (
            <div key={show.id as string} className="glass rounded-2xl p-5 border border-amber-500/15">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatIST(show.starts_at as string)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={show.status as string} />
                    <span className="text-xs text-slate-400">{totalConfirmed} confirmed seats</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <div>
                    <p className="text-xs text-slate-400">Revenue</p>
                    <p className="text-base font-bold text-amber-600 dark:text-amber-400">₹{Number(totalRevenue || 0).toFixed(2)}</p>
                  </div>
                  <Link to={`/organiser/events/${id}/shows/${show.id}`} className="btn btn-secondary btn-sm">Pricing</Link>
                  {show.status === 'draft' && (
                    <button
                      id={`publish-show-${show.id}`}
                      onClick={() => handleStatusChange(show.id as string, 'published')}
                      className="btn btn-primary btn-sm"
                    >
                      <CheckCircle size={12} />
                      Publish
                    </button>
                  )}
                  {show.status === 'published' && (
                    <button
                      id={`cancel-show-${show.id}`}
                      onClick={() => handleStatusChange(show.id as string, 'cancelled')}
                      className="btn btn-sm text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <XCircle size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Per-category breakdown */}
              {cats.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-700 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {cats.map((c: Record<string, unknown>) => (
                    <div key={c.category_id as string} className="text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <p className="font-medium text-slate-700 dark:text-slate-300">{c.category_name as string}</p>
                      <p className="text-slate-400">₹{Number(c.price || 0).toFixed(2)}</p>
                      <p className="text-emerald-500 font-medium">₹{Number(c.revenue || 0).toFixed(2)} revenue</p>
                      <p className="text-slate-400">{c.confirmed_bookings as number} booked / {c.total_seats as number} total</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
    published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${styles[status] ?? styles.draft}`}>{status}</span>
  );
}
