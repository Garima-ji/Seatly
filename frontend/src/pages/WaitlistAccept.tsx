import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { waitlistApi } from '../api';
import { useAuthStore } from '../store';
import { formatIST, formatINR } from '../utils/format';
import { CountdownTimer } from '../components/SeatMap';

export default function WaitlistAccept() {
  const { offerId } = useParams<{ offerId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !offerId) { setError('Invalid offer link.'); setLoading(false); return; }
    waitlistApi.acceptOffer(offerId, token)
      .then(setOffer)
      .catch((err: { response?: { data?: { error?: string } } }) => {
        setError(err?.response?.data?.error ?? 'Invalid or expired offer.');
      })
      .finally(() => setLoading(false));
  }, [offerId, token]);

  const handleAccept = () => {
    if (!offer || !user) { navigate('/login'); return; }
    const seat = offer.seat as Record<string, unknown>;
    navigate('/checkout', {
      state: {
        showId: seat.show_id,
        heldSeats: [{
          show_seat_id: seat.show_seat_id,
          row_label: seat.row_label,
          seat_number: seat.seat_number,
          category_name: seat.category_name,
          color_hex: seat.color_hex,
          price: seat.price,
          held_by_me: true,
          hold_expires_at: offer.offer_expires_at,
        }],
      },
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <span className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-16 animate-fade-in">
      {error ? (
        <div className="glass rounded-2xl p-8 text-center shadow-xl border border-red-500/20">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Offer Unavailable</h1>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      ) : offer ? (
        <div className="glass rounded-2xl p-8 shadow-xl border border-amber-500/20">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/50 mx-auto mb-4 shadow-md shadow-amber-500/10">
            <Clock size={28} className="text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-1">Seat Available!</h1>
          <p className="text-slate-500 text-sm text-center mb-5">Your waitlist seat is ready. Accept before it expires.</p>

          {/* Seat details */}
          {offer.seat ? (() => {
            const seat = offer.seat as Record<string, unknown>;
            return (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 mb-4 border border-slate-200/50 dark:border-slate-700/50">
                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{seat.event_title as string}</p>
                <p className="text-xs text-slate-500">{formatIST(seat.starts_at as string)} · {seat.venue_name as string}, {seat.city as string}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Row {seat.row_label as string}, Seat {seat.seat_number as number} · {seat.category_name as string}
                  </span>
                  <span className="text-base font-bold text-amber-600 dark:text-amber-400">{formatINR(Number(seat.price))}</span>
                </div>
              </div>
            );
          })() : null}

          {/* Expiry */}
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 mb-5">
            <span className="text-xs text-amber-700 dark:text-amber-300">Offer expires in:</span>
            <CountdownTimer expiresAt={offer.offer_expires_at as string} onExpire={() => setError('Offer expired.')} />
          </div>

          {user ? (
            <button id="accept-waitlist-offer" onClick={handleAccept} className="btn btn-primary btn-lg w-full">
              Accept & Checkout
            </button>
          ) : (
            <button onClick={() => navigate('/login')} className="btn btn-primary btn-lg w-full">
              Log in to Accept
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
