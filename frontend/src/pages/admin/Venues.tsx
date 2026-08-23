import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Building2, Trash2, Edit2, MapPin } from 'lucide-react';
import { adminApi } from '../../api';

export default function AdminVenues() {
  const qc = useQueryClient();
  const { data: venues = [], isLoading } = useQuery({ queryKey: ['admin-venues'], queryFn: adminApi.getVenues });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', city: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await adminApi.createVenue(form);
      setForm({ name: '', address: '', city: '' });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['admin-venues'] });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create venue.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete venue "${name}"?`)) return;
    try {
      await adminApi.deleteVenue(id);
      qc.invalidateQueries({ queryKey: ['admin-venues'] });
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to delete venue.');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Venues</h1>
        <button id="add-venue-btn" onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm">
          <Plus size={14} />
          Add Venue
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="glass rounded-2xl p-5 border border-amber-500/25 mb-6 animate-slide-up">
          <h2 className="text-sm font-bold mb-3 text-slate-900 dark:text-white">New Venue</h2>
          {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            <input id="venue-name" type="text" required className="input" placeholder="Name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input id="venue-address" type="text" required className="input" placeholder="Address" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <input id="venue-city" type="text" required className="input" placeholder="City" value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
              {saving ? 'Saving…' : 'Create Venue'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
        </div>
      ) : venues.length === 0 ? (
        <div className="text-center py-12">
          <Building2 size={40} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No venues yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {venues.map((v: Record<string, unknown>) => (
            <div key={v.id as string} className="glass rounded-xl p-4 border border-amber-500/15 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{v.name as string}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin size={11} className="text-amber-500" />
                  {v.address as string}, {v.city as string}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/admin/venues/${v.id}`} className="btn btn-secondary btn-sm">
                  <Edit2 size={12} />
                  Manage
                </Link>
                <button
                  id={`delete-venue-${v.id}`}
                  onClick={() => handleDelete(v.id as string, v.name as string)}
                  className="btn btn-sm text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
