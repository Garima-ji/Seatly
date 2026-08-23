import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, ShoppingCart, Ticket, ArrowLeft, ArrowRight } from 'lucide-react';
import { customerApi } from '../api';
import { useSeatMapStore, SeatData } from '../store';
import { formatINR } from '../utils/format';
import { CountdownTimer } from '../components/SeatMap';
import SparkleIcon from '../components/seatly/SparkleIcon';

interface LocationState {
  showId: string;
  heldSeats: SeatData[];
}

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;
  const { clearSelections } = useSeatMapStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ booking_ref: string; order_id: string } | null>(null);

  if (!state?.heldSeats?.length) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
        <p className="text-slate-500 font-semibold mb-3">No seats to checkout. Please select seats first.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-full bg-[#121316] text-white text-xs font-semibold hover:bg-black"
        >
          ← Go back
        </button>
      </div>
    );
  }

  const { heldSeats } = state;
  const totalPrice = heldSeats.reduce((sum, s) => sum + (s.price ?? 0), 0);

  const handleConfirm = async () => {
    setError('');
    setLoading(true);
    try {
      const holds: { hold_id: string; show_seat_id: string }[] = await customerApi.getHolds(state.showId);
      const holdIds = heldSeats
        .map((s) => holds.find((h) => h.show_seat_id === s.show_seat_id)?.hold_id)
        .filter(Boolean) as string[];

      if (holdIds.length === 0) {
        setError('Your holds have expired. Please select seats again.');
        return;
      }

      const order = await customerApi.confirmOrder(holdIds);
      clearSelections();
      setSuccess({ booking_ref: order.booking_ref, order_id: order.order_id });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto py-12 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center shadow-xl border border-slate-200/80 dark:border-slate-800">
          <div className="w-16 h-16 rounded-full bg-[#EAF8E5] text-[#2C8022] flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">Booking Confirmed!</h1>
          <p className="text-xs text-slate-500 mb-6">Your tickets and QR code are ready.</p>
          <div className="inline-block px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-6">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Booking Reference</p>
            <p className="text-xl font-black text-slate-900 dark:text-white tracking-widest font-mono">{success.booking_ref}</p>
          </div>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => navigate(`/orders/${success.order_id}`)}
              className="w-full py-3 px-5 rounded-full bg-[#121316] text-white hover:bg-black text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Ticket size={14} className="text-[#D4F63B]" />
              <span>View Ticket & QR Code</span>
            </button>
            <button
              onClick={() => navigate('/bookings')}
              className="w-full py-3 px-5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all"
            >
              My Bookings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Checkout</h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <ShoppingCart size={14} className="text-[#D4F63B]" />
          <span>Order Summary</span>
        </h2>

        <div className="space-y-2.5">
          {heldSeats.map((seat) => (
            <div key={seat.show_seat_id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-md" style={{ background: seat.color_hex }} />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Row {seat.row_label}, Seat {seat.seat_number}
                </span>
                <span className="text-[11px] text-slate-400">({seat.category_name})</span>
              </div>
              <div className="flex items-center gap-3">
                {seat.hold_expires_at && (
                  <CountdownTimer expiresAt={seat.hold_expires_at} />
                )}
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">{formatINR(seat.price)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Total</span>
          <span className="text-xl font-black text-slate-900 dark:text-white">{formatINR(totalPrice)}</span>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        ⏰ Seats are reserved for you. Complete checkout to get your instant QR ticket.
      </p>

      <button
        id="confirm-booking-btn"
        onClick={handleConfirm}
        disabled={loading}
        className="w-full py-4 px-6 rounded-full bg-[#121316] text-white hover:bg-black font-bold text-xs flex items-center justify-between transition-all disabled:opacity-40 shadow-lg shadow-black/10"
      >
        <span>{loading ? 'Confirming...' : 'Confirm & Pay'}</span>
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-[#D4F63B]">{formatINR(totalPrice)}</span>
          <div className="w-6 h-6 rounded-full bg-[#D4F63B] text-slate-950 flex items-center justify-center">
            <ArrowRight size={13} className="stroke-[2.5]" />
          </div>
        </div>
      </button>
    </div>
  );
}
