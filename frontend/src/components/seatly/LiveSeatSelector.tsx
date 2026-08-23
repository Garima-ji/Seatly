import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Calendar, Clock, MapPin, Edit2, RefreshCw, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
import { eventsApi, customerApi } from '../../api';

export interface MockSeat {
  id: string;
  row: string;
  num: number;
  status: 'available' | 'selected' | 'held' | 'booked';
  price: number;
  category: string;
  show_seat_id?: string;
}

interface LiveSeatSelectorProps {
  showId?: string | null;
  movieTitle?: string;
  dateTime?: string;
  venue?: string;
}

export default function LiveSeatSelector({
  showId = null,
  movieTitle = 'Dune: Part Two',
  dateTime = '24 May 2024 • 06:45 PM',
  venue = 'PVR Phoenix Marketcity, Mumbai',
}: LiveSeatSelectorProps) {
  const [seats, setSeats] = useState<MockSeat[]>([]);
  const [loading, setLoading] = useState(false);
  const [holdError, setHoldError] = useState('');
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Load seat map from backend on mount/showId change
  useEffect(() => {
    if (!showId) return;

    setLoading(true);
    setHoldError('');
    eventsApi.seatmap(showId)
      .then((data) => {
        const mapped = data.seats
          .filter((s: any) => !s.is_aisle) // Hide aisle spacers from being clicked
          .map((s: any) => ({
            id: `${s.row_label}${s.seat_number}`,
            row: s.row_label,
            num: s.seat_number,
            status: s.status === 'held'
              ? (s.held_by_me ? 'selected' : 'held')
              : (s.status as any),
            price: Number(s.price || 0),
            category: s.category_name,
            show_seat_id: s.show_seat_id,
          }));
        setSeats(mapped);
      })
      .catch((err) => {
        console.error('Failed to load live seatmap:', err);
        setHoldError('Failed to load the live seat plan. Please check your connection.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [showId]);

  const handleToggleSeat = async (seat: MockSeat) => {
    if (!showId) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'customer') return;
    setHoldError('');

    if (seat.status === 'selected') {
      // Release Hold
      try {
        const holds = await customerApi.getHolds(showId);
        const hold = holds.find((h: any) => h.show_seat_id === seat.show_seat_id);
        if (hold) {
          await customerApi.releaseHold(hold.hold_id);
        }
        setSeats((prev) =>
          prev.map((s) => (s.show_seat_id === seat.show_seat_id ? { ...s, status: 'available' } : s))
        );
      } catch (err: any) {
        console.error('Failed to release hold:', err);
        setHoldError('Failed to release seat hold. Please try again.');
      }
    } else if (seat.status === 'available') {
      // Create Hold
      try {
        await customerApi.createHold(seat.show_seat_id!);
        setSeats((prev) =>
          prev.map((s) => (s.show_seat_id === seat.show_seat_id ? { ...s, status: 'selected' } : s))
        );
      } catch (err: any) {
        const msg = err?.response?.data?.error || 'Failed to hold seat. It may have been selected by another user.';
        setHoldError(msg);
      }
    }
  };

  const selectedSeats = seats.filter((s) => s.status === 'selected');
  const totalPrice = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  const handleContinue = () => {
    if (selectedSeats.length === 0) {
      alert('Please select at least one seat to continue.');
      return;
    }

    // Format seats as expected by Checkout page LocationState
    const heldSeats = selectedSeats.map((s) => ({
      show_seat_id: s.show_seat_id!,
      seat_id: s.id,
      status: 'held' as const,
      row_label: s.row,
      seat_number: s.num,
      is_aisle: false,
      category_id: '',
      category_name: s.category,
      color_hex: '#2563eb',
      price: s.price,
      held_by_me: true,
      hold_expires_at: new Date(Date.now() + 600 * 1000).toISOString(),
      category_sold_out: false,
    }));

    navigate('/checkout', {
      state: {
        showId,
        heldSeats,
      },
    });
  };

  return (
    <div className="w-full rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 shadow-sm p-5 sm:p-6 space-y-6">
      {/* Top Bar: Back button, Show Details, and Step Flow */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700/60">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => window.history.back()}
            aria-label="Go back"
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700/70 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
              {movieTitle}
            </h2>
            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 font-medium pt-0.5">
              <span>{dateTime}</span>
              <span>•</span>
              <span className="truncate max-w-xs">{venue}</span>
            </div>
          </div>
        </div>

        {/* Stepper Progress */}
        <div className="flex items-center gap-3 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-[#D4F63B] text-slate-950 flex items-center justify-center text-[10px] font-bold">
              1
            </span>
            <span className="text-slate-900 dark:text-white">Seats</span>
          </div>

          <div className="w-6 h-[1px] bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-1.5 opacity-40">
            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">
              2
            </span>
            <span className="text-slate-500">Review</span>
          </div>

          <div className="w-6 h-[1px] bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-1.5 opacity-40">
            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">
              3
            </span>
            <span className="text-slate-500">Payment</span>
          </div>
        </div>
      </div>

      {/* Main Seat Booking Grid & Selection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Status Legend (2 cols on lg) */}
        <div className="lg:col-span-2 space-y-4 pt-1">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
            Select Your Seats
          </h4>

          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-md bg-[#CBE7C9] dark:bg-[#436e40] shrink-0" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-md bg-[#D4F63B] text-slate-950 flex items-center justify-center text-[9px] font-bold shrink-0 border border-slate-900">
                <Check size={10} className="stroke-[3]" />
              </span>
              <span>Selected</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-md bg-[#FFE169] shrink-0" />
              <span>Held</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-md bg-[#E2E4E8] dark:bg-slate-700 shrink-0" />
              <span>Booked</span>
            </div>
          </div>
        </div>

        {/* Center Seat Map (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center overflow-x-auto py-2">
          {/* Curved Screen Banner */}
          <div className="relative w-full max-w-md mb-6 flex flex-col items-center">
            <div className="w-3/4 h-2 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded-t-full opacity-60" />
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mt-1">
              SCREEN THIS WAY
            </span>
          </div>

          {holdError && (
            <div className="w-full max-w-md p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{holdError}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="animate-spin text-[#D4F63B]" size={36} />
              <p className="text-xs text-slate-500 mt-3 font-medium">Loading live seat plan...</p>
            </div>
          ) : seats.length > 0 ? (
            /* Seat Rows Matrix */
            <div className="space-y-2 select-none min-w-max px-2">
              {Array.from(new Set(seats.map((s) => s.row))).sort().map((rowLabel) => {
                const rowSeats = seats.filter((s) => s.row === rowLabel).sort((a, b) => a.num - b.num);
                return (
                  <div key={rowLabel} className="flex items-center gap-3">
                    {/* Left row letter */}
                    <span className="w-4 text-xs font-bold text-slate-400 text-center shrink-0">
                      {rowLabel}
                    </span>

                    {/* Seat Grid */}
                    <div className="flex items-center gap-1">
                      {rowSeats.map((seat) => (
                        <SeatButton
                          key={seat.show_seat_id}
                          seat={seat}
                          onToggle={() => handleToggleSeat(seat)}
                        />
                      ))}
                    </div>

                    {/* Right row letter */}
                    <span className="w-4 text-xs font-bold text-slate-400 text-center shrink-0">
                      {rowLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-xs italic">Select a featured event above to load seats.</p>
          )}
        </div>

        {/* Right Summary Card: "Your Selection" (3 cols on lg) */}
        <div className="lg:col-span-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-4 border border-slate-200/60 dark:border-slate-700/60 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                Your Selection
              </h3>
              <button
                type="button"
                onClick={() => setSeats((prev) => prev.map((s) => s.status === 'selected' ? { ...s, status: 'available' } : s))}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                Edit
              </button>
            </div>

            {/* Selected Seats List */}
            <div className="space-y-2.5 pt-3">
              {selectedSeats.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  No seats selected yet.
                </p>
              ) : (
                selectedSeats.map((seat) => (
                  <div key={seat.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-[#121316] text-white flex items-center justify-center text-[9px] font-bold">
                        <Check size={10} className="stroke-[3]" />
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {seat.id}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      ₹{seat.price}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Total & Continue CTA */}
          <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total
              </span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                ₹{totalPrice.toLocaleString()}
              </span>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              disabled={selectedSeats.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-[#121316] hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-sm"
            >
              <span>Continue</span>
              <ArrowRight size={13} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeatButton({ seat, onToggle }: { seat: MockSeat; onToggle: () => void }) {
  const isSelected = seat.status === 'selected';
  const isHeld = seat.status === 'held';
  const isBooked = seat.status === 'booked';
  const isAvailable = seat.status === 'available';

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isBooked || isHeld}
      aria-label={`Seat ${seat.id} - ${seat.status}`}
      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-[6px] text-[10px] font-bold flex items-center justify-center transition-all duration-150 ${
        isSelected
          ? 'bg-[#D4F63B] text-slate-950 border border-slate-950 scale-105 shadow-sm'
          : isHeld
          ? 'bg-[#FFE169] text-amber-900 cursor-not-allowed'
          : isBooked
          ? 'bg-[#E2E4E8] dark:bg-slate-700 text-slate-400 cursor-not-allowed'
          : 'bg-[#CBE7C9] dark:bg-[#436e40] hover:bg-[#bce0ba] dark:hover:bg-[#4f804c] text-emerald-950 dark:text-white'
      }`}
    >
      {isSelected ? <Check size={12} className="stroke-[3]" /> : null}
    </button>
  );
}
