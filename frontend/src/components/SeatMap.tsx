import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Clock, Lock, Check, Star } from 'lucide-react';
import type { SeatData } from '../store';

interface CountdownProps {
  expiresAt: string;
  onExpire?: () => void;
}

export function CountdownTimer({ expiresAt, onExpire }: CountdownProps) {
  const [seconds, setSeconds] = useState<number>(() => {
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (seconds <= 0) {
      onExpire?.();
      return;
    }
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { onExpire?.(); clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isWarning = seconds <= 60;
  const isCritical = seconds <= 30;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 text-xs font-mono font-bold rounded px-1.5 py-0.5',
        isCritical && 'text-red-600 dark:text-red-400 animate-pulse',
        isWarning && !isCritical && 'text-amber-600 dark:text-amber-400',
        !isWarning && 'text-emerald-600 dark:text-emerald-400'
      )}
    >
      {isWarning ? <AlertTriangle size={10} /> : <Clock size={10} />}
      {mins}:{secs.toString().padStart(2, '0')}
    </span>
  );
}

// ─── Seat Tile ─────────────────────────────────────────────────────────────

interface SeatTileProps {
  seat: SeatData;
  isSelected: boolean;
  onClick: (seat: SeatData) => void;
  onHoldExpire?: (showSeatId: string) => void;
}

export function SeatTile({ seat, isSelected, onClick, onHoldExpire }: SeatTileProps) {
  if (seat.is_aisle) return <div className="seat-tile seat-aisle" />;

  const isHeldByMe = seat.held_by_me && seat.status === 'held';
  const isHeldByOther = !seat.held_by_me && seat.status === 'held';
  const isBooked = seat.status === 'booked';
  const isAvailable = seat.status === 'available';
  const isCategoryFull = seat.category_sold_out && isAvailable;

  // Determine seconds remaining for warning threshold
  const secsRemaining = isHeldByMe && seat.hold_expires_at
    ? Math.max(0, Math.floor((new Date(seat.hold_expires_at).getTime() - Date.now()) / 1000))
    : null;
  const isWarning = secsRemaining !== null && secsRemaining <= 60;

  const tileClass = clsx('seat-tile', {
    'seat-available': isAvailable && !isCategoryFull,
    'seat-selected': isSelected && isAvailable,
    'seat-held-mine': isHeldByMe && !isWarning,
    'seat-held-mine-warning': isHeldByMe && isWarning,
    'seat-held-other': isHeldByOther,
    'seat-booked': isBooked,
    'seat-waitlist': isCategoryFull,
  });

  const isClickable = (isAvailable && !isCategoryFull) || isCategoryFull || isSelected || isHeldByMe;
  const label = `${seat.row_label}${seat.seat_number}`;

  return (
    <button
      id={`seat-${seat.show_seat_id}`}
      className={tileClass}
      onClick={() => isClickable && onClick(seat)}
      disabled={isHeldByOther || isBooked}
      title={`${label} — ${seat.category_name} — ${seat.price != null ? `₹${Number(seat.price).toFixed(2)}` : 'N/A'}`}
      aria-label={`Seat ${label}, ${seat.category_name}, ${
        isBooked ? 'booked' :
        isHeldByOther ? 'held' :
        isHeldByMe ? 'held by you' :
        isSelected ? 'selected' :
        isCategoryFull ? 'join waitlist' :
        'available'
      }`}
    >
      {/* Icon overlay */}
      {isBooked && <Check size={10} className="absolute text-slate-300" />}
      {isHeldByOther && <Lock size={10} className="absolute text-[#2A3B8C]" />}
      {isCategoryFull && <Star size={9} className="absolute text-amber-500" />}

      {/* Countdown badge for own held seat */}
      {isHeldByMe && seat.hold_expires_at && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap">
          <CountdownTimer
            expiresAt={seat.hold_expires_at}
            onExpire={() => onHoldExpire?.(seat.show_seat_id)}
          />
        </div>
      )}

      {/* Seat label */}
      <span className="text-[9px] leading-none select-none font-bold">
        {seat.seat_number}
      </span>
    </button>
  );
}

// ─── Full Seat Map ─────────────────────────────────────────────────────────

function getRowCategory(rowLabel: string) {
  const upper = rowLabel.toUpperCase();
  if (['A', 'B', 'C'].includes(upper)) {
    return {
      name: 'Premium',
      color: '#8B5CF6',
      textClass: 'text-[#8B5CF6] dark:text-[#A78BFA]',
      bgClass: 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/30',
      dotClass: 'bg-[#8B5CF6]',
    };
  }
  if (['D', 'E', 'F', 'G', 'H', 'I', 'J'].includes(upper)) {
    return {
      name: 'Standard',
      color: '#3B82F6',
      textClass: 'text-[#3B82F6] dark:text-[#60A5FA]',
      bgClass: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30',
      dotClass: 'bg-[#3B82F6]',
    };
  }
  return {
    name: 'Economy',
    color: '#22C55E',
    textClass: 'text-[#22C55E] dark:text-[#4ADE80]',
    bgClass: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30',
    dotClass: 'bg-[#22C55E]',
  };
}

interface SeatMapProps {
  seats: SeatData[];
  selectedSeatIds: Set<string>;
  onSeatClick: (seat: SeatData) => void;
  onHoldExpire?: (showSeatId: string) => void;
}

export default function SeatMap({ seats, selectedSeatIds, onSeatClick, onHoldExpire }: SeatMapProps) {
  // Group seats by row
  const rows = seats.reduce((acc, seat) => {
    if (!acc[seat.row_label]) acc[seat.row_label] = [];
    acc[seat.row_label].push(seat);
    return acc;
  }, {} as Record<string, SeatData[]>);

  const rowLabels = Object.keys(rows).sort();

  return (
    <div className="w-full flex flex-col items-center">
      {/* 1. Curved Screen Arc Banner */}
      <div className="w-full max-w-xl flex flex-col items-center mb-5">
        <div className="w-full h-4 border-t-2 border-slate-300/80 dark:border-slate-700/80 rounded-[50%/100%_100%_0_0] bg-gradient-to-b from-slate-200/40 to-transparent dark:from-slate-800/40 shadow-xs mb-1" />
        <span className="text-[10px] tracking-[0.25em] font-extrabold uppercase text-slate-400 dark:text-slate-500">
          SCREEN THIS WAY
        </span>
      </div>

      {/* 2. Top Legend Row */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 mb-7 py-2 px-4 sm:px-5 rounded-full bg-[#F9F9F7] dark:bg-[#181A20] border border-slate-200/70 dark:border-slate-800 shadow-xs">
        <LegendItem className="bg-[#F2F2EE] border border-slate-300/60 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md" label="Available" />
        <LegendItem className="bg-[#D4F63B] border border-[#BDE41F] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md" label="Selected" />
        <LegendItem className="bg-[#FDE8B3] border border-[#FCD278] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md" label="Your hold" />
        <LegendItem className="bg-[#D8DFFB] border border-[#B3C0F8] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md" label="Held" />
        <LegendItem className="bg-[#606470] border border-[#4C505C] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md" label="Booked" />
        <LegendItem className="bg-[#FAF7ED] border border-dashed border-amber-400 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md" label="Waitlist" />
      </div>

      {/* 3. Seat Grid Container */}
      <div className="inline-flex flex-col gap-1.5 sm:gap-2 max-w-full p-3 sm:p-5 rounded-[28px] bg-[#F7F7F4]/60 dark:bg-[#14161B]/60 border border-slate-200/60 dark:border-slate-800/80">
        {rowLabels.map((rowLabel) => {
          const rowSeats = rows[rowLabel].sort((a, b) => a.seat_number - b.seat_number);
          const rowCat = getRowCategory(rowLabel);
          const isSectionStart = rowLabel === 'A' || rowLabel === 'D' || rowLabel === 'K';

          return (
            <div key={rowLabel} className="flex flex-col items-center">
              {/* Category section divider tag */}
              {isSectionStart && (
                <div className="w-full flex items-center justify-between px-2 pt-2 pb-1 border-t border-slate-200/40 dark:border-slate-800/60 first:border-none">
                  <div className="flex items-center gap-1.5">
                    <span className={clsx('w-2 h-2 rounded-full', rowCat.dotClass)} />
                    <span className={clsx('text-[10px] font-extrabold uppercase tracking-wider', rowCat.textClass)}>
                      {rowCat.name} ({rowLabel === 'A' ? 'A–C' : rowLabel === 'D' ? 'D–J' : 'K–O'})
                    </span>
                  </div>
                  <span className={clsx('text-[10px] font-bold', rowCat.textClass)}>
                    {rowLabel === 'A' ? '₹1500' : rowLabel === 'D' ? '₹800' : '₹400'}
                  </span>
                </div>
              )}

              {/* Row with Color Coded Labels */}
              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                {/* Row label left with category color coding */}
                <span className={clsx('text-[10px] sm:text-xs font-black w-3.5 sm:w-4 text-center select-none', rowCat.textClass)}>
                  {rowLabel}
                </span>

                {/* Seats in row */}
                <div className="flex gap-[3px] sm:gap-1 relative items-center">
                  {rowSeats.map((seat) => (
                    <SeatTile
                      key={seat.show_seat_id}
                      seat={seat}
                      isSelected={selectedSeatIds.has(seat.show_seat_id)}
                      onClick={onSeatClick}
                      onHoldExpire={onHoldExpire}
                    />
                  ))}
                </div>

                {/* Row label right with category color coding */}
                <span className={clsx('text-[10px] sm:text-xs font-black w-3.5 sm:w-4 text-center select-none', rowCat.textClass)}>
                  {rowLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Bottom Tip */}
      <div className="flex justify-center items-center gap-1.5 mt-6 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span className="text-amber-500">💡</span>
        <span>Tip: You can select max 8 seats per booking.</span>
      </div>
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className={clsx('rounded-md shadow-xs', className)} />
      <span className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</span>
    </div>
  );
}
