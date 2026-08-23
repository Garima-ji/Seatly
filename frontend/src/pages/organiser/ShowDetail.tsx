import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Save } from 'lucide-react';
import { organiserApi } from '../../api';
import { formatINR } from '../../utils/format';

export default function OrganiserShowDetail() {
  const { eventId, showId } = useParams<{ eventId: string; showId: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: categories = [] } = useQuery({
    queryKey: ['organiser-cats-for-show', eventId],
    queryFn: async () => {
      const eventData = await organiserApi.getSummary(eventId!);
      const venueData = await organiserApi.getVenue(eventData.event.venue_id);
      return venueData.categories || [];
    },
  });

  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const priceList = Object.entries(prices)
        .filter(([, v]) => v !== '')
        .map(([category_id, price]) => ({ category_id, price: parseFloat(price) }));
      await organiserApi.updatePricing(showId!, priceList);
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ['organiser-summary', eventId] });
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate(-1)} className="text-sm text-amber-600 dark:text-amber-400 font-semibold hover:underline mb-4 block">← Back</button>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
        <DollarSign size={20} className="text-amber-500" />
        Set Pricing
      </h1>

      {success && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm mb-4">
          ✓ Pricing saved successfully.
        </div>
      )}

      <div className="glass rounded-2xl p-5 border border-amber-500/15">
        <div className="space-y-3 mb-5">
          {(categories as Record<string, unknown>[]).map((cat) => (
            <div key={cat.id as string} className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <span className="w-3 h-3 rounded-sm" style={{ background: cat.color_hex as string }} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cat.name as string}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">₹</span>
                <input
                  id={`price-${cat.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="input w-28 text-sm"
                  value={prices[cat.id as string] ?? ''}
                  onChange={(e) => setPrices({ ...prices, [cat.id as string]: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>

        {(categories as Record<string, unknown>[]).length === 0 && (
          <p className="text-slate-500 text-sm py-4 text-center">No categories defined for this venue. Ask an admin to create seat categories first.</p>
        )}

        <button
          id="save-pricing-btn"
          onClick={handleSave}
          disabled={saving || Object.keys(prices).length === 0}
          className="btn btn-primary btn-md"
        >
          {saving ? 'Saving…' : (
            <>
              <Save size={14} />
              Save Pricing
            </>
          )}
        </button>
      </div>
    </div>
  );
}
