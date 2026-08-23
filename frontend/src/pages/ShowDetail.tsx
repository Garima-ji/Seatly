import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Calendar, Clock, ArrowRight, AlertCircle, Info, Armchair } from 'lucide-react';
import { eventsApi, customerApi } from '../api';
import { useSeatMapStore, useAuthStore, SeatData } from '../store';
import { joinShow, leaveShow } from '../socket';
import SeatMap from '../components/SeatMap';
import SparkleIcon from '../components/seatly/SparkleIcon';
import { formatIST, formatINR } from '../utils/format';

export default function ShowDetail() {
  const { showId } = useParams<{ showId: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [holdError, setHoldError] = useState('');
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [waitlistCategory, setWaitlistCategory] = useState<string | null>(null);
  const [waitlistMsg, setWaitlistMsg] = useState('');

  const store = useSeatMapStore();
  const seatsArr = Object.values(store.seats);
  const selectedIds = store.selectedSeatIds;
  const heldIds = store.heldSeatIds;

  // Fetch seat map snapshot (initial HTTP load)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['seatmap', showId],
    queryFn: () => eventsApi.seatmap(showId!),
    enabled: !!showId,
    staleTime: 0,
    retry: 1,
  });

  useEffect(() => {
    if (data?.seats) {
      store.setSeats(data.seats);
      // Mark any already-held seats
      data.seats.filter((s: SeatData) => s.held_by_me).forEach((s: SeatData) => store.addHeld(s.show_seat_id));
    }
  }, [data]);

  // Join Socket.io room for real-time updates
  useEffect(() => {
    if (!showId) return;
    store.setShowId(showId);
    joinShow(showId);
    return () => { leaveShow(showId!); };
  }, [showId]);

  const handleSeatClick = useCallback(async (seat: SeatData) => {
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'customer') return;
    setHoldError('');

    // If category is sold out → join waitlist instead
    if (seat.category_sold_out && seat.status === 'available') {
      setWaitlistCategory(seat.category_id);
      return;
    }

    if (seat.held_by_me) {
      // Release hold
      try {
        const holds = await customerApi.getHolds(showId!);
        const hold = holds.find((h: { show_seat_id: string }) => h.show_seat_id === seat.show_seat_id);
        if (hold) {
          await customerApi.releaseHold(hold.hold_id);
        }
      } catch { /* ignore */ }
      store.removeHeld(seat.show_seat_id);
      store.updateSeat(seat.show_seat_id, { status: 'available', held_by_me: false });
      return;
    }

    if (selectedIds.has(seat.show_seat_id)) {
      // Unselect if already selected
      store.toggleSelect(seat.show_seat_id);
      return;
    }

    if (seat.status === 'available') {
      // Select seat
      store.toggleSelect(seat.show_seat_id);
    }
  }, [user, showId, store, navigate, selectedIds]);

  const handleHoldExpire = useCallback((showSeatId: string) => {
    store.removeHeld(showSeatId);
    store.updateSeat(showSeatId, { status: 'available', held_by_me: false, hold_expires_at: undefined });
  }, [store]);

  const handleJoinWaitlist = async (categoryId: string) => {
    try {
      const res = await customerApi.joinWaitlist(showId!, categoryId);
      setWaitlistMsg(`You are #${res.position} on the waitlist! We'll email you when a seat opens.`);
      setWaitlistCategory(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setHoldError(msg ?? 'Failed to join waitlist');
    }
  };

  // Selected & Held seats calculation — combine all active user picks and sum prices correctly
  const selectedSeatObjects = seatsArr.filter((s) => selectedIds.has(s.show_seat_id));
  const heldSeatObjects = seatsArr.filter((s) => heldIds.has(s.show_seat_id) && s.held_by_me);
  
  const activeSelectionList = [...new Map([...heldSeatObjects, ...selectedSeatObjects].map((s) => [s.show_seat_id, s])).values()];
  const totalPrice = activeSelectionList.reduce((sum, s) => sum + Number(s.price || 0), 0);

  const handleProceedToCheckout = async () => {
    if (activeSelectionList.length === 0) return;
    if (!user) { navigate('/login'); return; }

    // Hold any pre-hold selected seats before checkout
    const unheldSelected = activeSelectionList.filter((s) => !s.held_by_me);
    for (const seat of unheldSelected) {
      try {
        const hold = await customerApi.createHold(seat.show_seat_id);
        store.addHeld(seat.show_seat_id);
        store.updateSeat(seat.show_seat_id, {
          status: 'held',
          held_by_me: true,
          hold_expires_at: hold.expires_at,
        });
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setHoldError(msg ?? 'Failed to hold selected seats');
        return;
      }
    }

    navigate('/checkout', { state: { showId, heldSeats: activeSelectionList } });
  };

  // Sold-out categories
  const soldOutCategories = [...new Map(
    seatsArr.filter((s) => s.category_sold_out).map((s) => [s.category_id, { id: s.category_id, name: s.category_name }])
  ).values()];

  if (isLoading) return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="h-10 w-64 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse mb-6" />
      <div className="h-64 w-full rounded-3xl bg-slate-200 dark:bg-slate-800 animate-pulse mb-8" />
      <div className="h-96 rounded-3xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
    </div>
  );

  if (isError || !data) {
    const isNotFound = (error as { response?: { status?: number } })?.response?.status === 404;
    return (
      <div className="text-center py-20 px-4">
        <p className="text-slate-800 dark:text-slate-200 font-bold text-xl mb-2">
          {isNotFound ? 'Show not found.' : 'Unable to load seat map.'}
        </p>
        <p className="text-sm text-slate-500 mb-6">
          {isNotFound ? 'The show you are looking for does not exist or has been removed.' : 'Please check your connection and try again.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          {!isNotFound && (
            <button onClick={() => refetch()} className="btn btn-secondary btn-sm">
              Try Again
            </button>
          )}
          <button onClick={() => navigate(-1)} className="btn btn-primary btn-sm">
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  const show = data.show;
  const posterUrl = show.poster_url || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80';

  return (
    <div className="w-full animate-fade-in space-y-6">
      {/* 1. Header Banner with Increased Height, Top Gradient, and Title Positioned Towards Top */}
      <div className="relative w-full min-h-[260px] sm:min-h-[300px] md:min-h-[330px] rounded-[28px] sm:rounded-[36px] overflow-hidden p-6 sm:p-9 bg-slate-950 border border-slate-200/60 dark:border-slate-800 shadow-xl flex flex-col justify-start">
        {/* Background Movie Banner Image */}
        <img
          src={posterUrl}
          alt={show.event_title}
          className="absolute inset-0 w-full h-full object-cover object-top filter contrast-[1.1] brightness-[0.8]"
        />

        {/* Top Dark Black Gradient for Absolute White Title Legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/95 via-black/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent" />

        {/* Content on top of Gradient Banner - Positioned towards top */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-2xl bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all shadow-xs shrink-0 mt-1"
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#D4F63B] text-slate-950 uppercase tracking-widest shadow-xs">
                  Now Booking
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-normal tracking-tight text-white flex flex-wrap items-baseline gap-2">
                <span className="font-serif italic drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] text-white">
                  {show.event_title || 'Sholay — The Return'}
                </span>
                <span className="text-xs sm:text-sm font-sans font-medium text-slate-300 drop-shadow-sm">
                  (4K Remaster)
                </span>
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-200 mt-2 drop-shadow-sm">
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-[#D4F63B]" />
                  {show.venue_name || 'PVR Phoenix Palladium, Mumbai'}
                </span>
                <span className="text-slate-400">•</span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-[#D4F63B]" />
                  {formatIST(show.starts_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Seats Held Timer Pill Badge */}
          <div className="self-start flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/20 shadow-md">
            <div className="w-7 h-7 rounded-full bg-[#D4F63B] flex items-center justify-center text-slate-950 shadow-xs">
              <Clock size={14} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Seats held for</p>
              <p className="text-sm font-extrabold text-[#D4F63B] font-mono leading-none mt-0.5">
                09:48
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Warnings & Alerts */}
      {user && user.email_verified === false && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-sm shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Please verify your email address to hold seats and book tickets.</span>
          </div>
          <button
            onClick={() => navigate('/verify-email')}
            className="text-xs font-bold text-amber-700 dark:text-amber-300 underline hover:text-amber-800"
          >
            Verify Now →
          </button>
        </div>
      )}

      {holdError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold">
          <AlertCircle size={14} />
          {holdError}
        </div>
      )}

      {waitlistMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          {waitlistMsg}
        </div>
      )}

      {/* Waitlist modal */}
      {waitlistCategory && (
        <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 animate-slide-up">
          <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mb-2">
            This category is sold out. Would you like to join the waitlist?
          </p>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm text-xs" onClick={() => handleJoinWaitlist(waitlistCategory)}>
              Join Waitlist
            </button>
            <button className="btn btn-secondary btn-sm text-xs" onClick={() => setWaitlistCategory(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* 2. Main Content Grid (Left SeatMap, Right Panels) */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        {/* Left Column: Seat Map */}
        <div className="flex-1 w-full bg-white dark:bg-slate-900 rounded-[32px] p-4 sm:p-7 border border-slate-200/70 dark:border-slate-800 shadow-xs flex flex-col items-center">
          <SeatMap
            seats={seatsArr}
            selectedSeatIds={selectedIds}
            onSeatClick={handleSeatClick}
            onHoldExpire={handleHoldExpire}
          />
        </div>

        {/* Right Column: 3 Stacked Panels */}
        <div className="w-full lg:w-80 shrink-0 space-y-5">
          {/* Card 1: Seat Categories */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3.5">Seat Categories</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-md bg-[#8B5CF6]" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Premium</span>
                </div>
                <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">₹1500.00</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-md bg-[#3B82F6]" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Standard</span>
                </div>
                <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">₹800.00</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-md bg-[#22C55E]" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Economy</span>
                </div>
                <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">₹400.00</span>
              </div>
            </div>
          </div>

          {/* Card 2: Your Selection & Checkout Action */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Your Selection</h3>
              <button
                onClick={() => store.clearSelections()}
                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              >
                Clear all
              </button>
            </div>

            {/* List of selected or held seats */}
            <div className="space-y-2.5">
              {activeSelectionList.length === 0 ? (
                <div className="text-center py-4 text-xs font-medium text-slate-400">
                  Click seats on the map to select
                </div>
              ) : (
                activeSelectionList.map((seat) => (
                  <div key={seat.show_seat_id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-none">
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white">{seat.row_label}{seat.seat_number}</p>
                      <p className="text-[11px] text-slate-500 font-semibold">{seat.category_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100">{formatINR(seat.price)}</span>
                      <button
                        onClick={() => handleSeatClick(seat)}
                        className="text-slate-400 hover:text-red-500 font-bold text-xs p-1"
                        title="Remove seat"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total price */}
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 dark:text-white">Total</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">
                {formatINR(totalPrice)}
              </span>
            </div>

            {/* Checkout Action Button */}
            <button
              id="checkout-btn"
              onClick={handleProceedToCheckout}
              disabled={activeSelectionList.length === 0}
              className="w-full py-3.5 px-5 rounded-full bg-[#121316] text-white hover:bg-black font-bold text-xs flex items-center justify-between transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              <span>Continue to Checkout</span>
              <div className="w-7 h-7 rounded-full bg-[#D4F63B] text-slate-950 flex items-center justify-center shadow-xs">
                <ArrowRight size={14} className="stroke-[2.5]" />
              </div>
            </button>
          </div>

          {/* Card 3: Dark Booking Tips Panel */}
          <div className="bg-[#121316] text-white rounded-3xl p-5 relative overflow-hidden shadow-xl border border-slate-800">
            <div className="flex items-center gap-1.5 mb-4">
              <h3 className="text-sm font-extrabold text-white tracking-tight">Booking Tips</h3>
              <SparkleIcon size={14} className="text-[#D4F63B]" />
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 relative z-10 max-w-[200px]">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-[#D4F63B]">
                  <Clock size={12} />
                </div>
                <p className="leading-snug">Seats are automatically released after 10 minutes of inactivity.</p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-[#D4F63B]">
                  <Info size={12} />
                </div>
                <p className="leading-snug">Don't refresh or go back, your seats are safe.</p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-[#D4F63B]">
                  <Armchair size={12} />
                </div>
                <p className="leading-snug">Select seats together for a better experience.</p>
              </div>
            </div>

            {/* Recliner chair graphic illustration in bottom right corner */}
            <div className="absolute -bottom-2 -right-3 opacity-80 pointer-events-none">
              <Armchair size={84} className="text-slate-800 stroke-[1.2]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

