import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Tag, Grid3X3 } from 'lucide-react';
import { adminApi } from '../../api';

export default function AdminVenueDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: venue } = useQuery({ queryKey: ['admin-venue', id], queryFn: () => adminApi.getVenues().then((vs: Record<string, unknown>[]) => vs.find((v) => v.id === id)) });
  const { data: categories = [] } = useQuery({ queryKey: ['admin-cats', id], queryFn: () => adminApi.getCategories(id!) });
  const { data: seats = [] } = useQuery({ queryKey: ['admin-seats', id], queryFn: () => adminApi.getSeats(id!) });

  const [catForm, setCatForm] = useState({ name: '', color_hex: '#6366f1' });
  const [showCatForm, setShowCatForm] = useState(false);
  const [savingCat, setSavingCat] = useState(false);

  const [seatForm, setSeatForm] = useState({ rows: 10, seatsPerRow: 15, category_id: '' });
  const [showSeatForm, setShowSeatForm] = useState(false);
  const [generatingSeats, setGeneratingSeats] = useState(false);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCat(true);
    try {
      await adminApi.createCategory(id!, catForm);
      setCatForm({ name: '', color_hex: '#6366f1' });
      setShowCatForm(false);
      qc.invalidateQueries({ queryKey: ['admin-cats', id] });
    } catch { /* ignore */ }
    setSavingCat(false);
  };

  const handleGenerateSeats = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seatForm.category_id) return;
    setGeneratingSeats(true);
    try {
      const rows = Array.from({ length: seatForm.rows }, (_, ri) => {
        const rowLabel = String.fromCharCode(65 + ri); // A, B, C, ...
        return Array.from({ length: seatForm.seatsPerRow }, (_, si) => ({
          row_label: rowLabel,
          seat_number: si + 1,
          category_id: seatForm.category_id,
        }));
      }).flat();
      await adminApi.createSeats(id!, rows);
      qc.invalidateQueries({ queryKey: ['admin-seats', id] });
      setShowSeatForm(false);
    } catch { /* ignore */ }
    setGeneratingSeats(false);
  };

  const rowCount = [...new Set((seats as Record<string, unknown>[]).map((s) => s.row_label))].length;
  const seatCount = (seats as Record<string, unknown>[]).length;

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
        {(venue as Record<string, unknown>)?.name as string ?? 'Venue'}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {(venue as Record<string, unknown>)?.address as string}, {(venue as Record<string, unknown>)?.city as string}
      </p>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="glass rounded-xl p-4 border border-amber-500/15 text-center">
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{(categories as unknown[]).length}</p>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Categories</p>
        </div>
        <div className="glass rounded-xl p-4 border border-amber-500/15 text-center">
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{rowCount}</p>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Rows</p>
        </div>
        <div className="glass rounded-xl p-4 border border-amber-500/15 text-center">
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{seatCount}</p>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Total Seats</p>
        </div>
      </div>

      {/* Categories */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Tag size={16} className="text-amber-500" />
            Seat Categories
          </h2>
          <button id="add-cat-btn" onClick={() => setShowCatForm(!showCatForm)} className="btn btn-secondary btn-sm">
            <Plus size={12} />
            Add Category
          </button>
        </div>

        {showCatForm && (
          <form onSubmit={handleCreateCategory} className="glass rounded-xl p-4 border border-amber-500/25 mb-3 animate-slide-up">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                <input id="cat-name" type="text" required className="input" placeholder="e.g. Premium"
                  value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Color</label>
                <input id="cat-color" type="color" className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                  value={catForm.color_hex} onChange={(e) => setCatForm({ ...catForm, color_hex: e.target.value })} />
              </div>
              <button type="submit" disabled={savingCat} className="btn btn-primary btn-sm">
                {savingCat ? 'Saving…' : 'Add'}
              </button>
              <button type="button" onClick={() => setShowCatForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          {(categories as Record<string, unknown>[]).map((cat) => (
            <div key={cat.id as string} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-sm border border-slate-200/60 dark:border-slate-700/60">
              <span className="w-3 h-3 rounded-full" style={{ background: cat.color_hex as string }} />
              <span className="text-slate-700 dark:text-slate-300 text-xs font-medium">{cat.name as string}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Seat Generation */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Grid3X3 size={16} className="text-amber-500" />
            Seats ({seatCount})
          </h2>
          <button id="generate-seats-btn" onClick={() => setShowSeatForm(!showSeatForm)} className="btn btn-secondary btn-sm">
            <Plus size={12} />
            Generate Layout
          </button>
        </div>

        {showSeatForm && (
          <form onSubmit={handleGenerateSeats} className="glass rounded-xl p-4 border border-amber-500/25 mb-3 animate-slide-up">
            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Rows (A, B, C…)</label>
                <input id="seat-rows" type="number" min="1" max="26" required className="input"
                  value={seatForm.rows} onChange={(e) => setSeatForm({ ...seatForm, rows: parseInt(e.target.value) })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Seats per Row</label>
                <input id="seats-per-row" type="number" min="1" max="100" required className="input"
                  value={seatForm.seatsPerRow} onChange={(e) => setSeatForm({ ...seatForm, seatsPerRow: parseInt(e.target.value) })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                <select id="seat-category" required className="input"
                  value={seatForm.category_id} onChange={(e) => setSeatForm({ ...seatForm, category_id: e.target.value })}>
                  <option value="">Select category…</option>
                  {(categories as Record<string, unknown>[]).map((c) => (
                    <option key={c.id as string} value={c.id as string}>{c.name as string}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Will generate {seatForm.rows * seatForm.seatsPerRow} seats in rows A–{String.fromCharCode(64 + seatForm.rows)}.
              Existing seats at the same row/number will be updated.
            </p>
            <div className="flex gap-2">
              <button type="submit" disabled={generatingSeats} className="btn btn-primary btn-sm">
                {generatingSeats ? 'Generating…' : 'Generate Seats'}
              </button>
              <button type="button" onClick={() => setShowSeatForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
            </div>
          </form>
        )}

        {/* Mini seat map preview */}
        {seatCount > 0 && (
          <div className="glass rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50 overflow-auto max-h-64">
            {[...new Set((seats as Record<string, unknown>[]).map((s) => s.row_label as string))].sort().map((row) => {
              const rowSeats = (seats as Record<string, unknown>[]).filter((s) => s.row_label === row).sort((a, b) => (a.seat_number as number) - (b.seat_number as number));
              return (
                <div key={row} className="flex items-center gap-1 mb-1">
                  <span className="text-xs text-slate-400 w-4">{row}</span>
                  {rowSeats.map((s) => (
                    <div
                      key={s.id as string}
                      className="w-4 h-4 rounded-sm"
                      style={{ background: s.color_hex as string, opacity: 0.8 }}
                      title={`${row}${s.seat_number}`}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
