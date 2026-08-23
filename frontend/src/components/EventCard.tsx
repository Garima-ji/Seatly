import { Link } from 'react-router-dom';
import { MapPin, Calendar, Ticket, ArrowRight } from 'lucide-react';
import { formatIST } from '../utils/format';

const EVENT_TYPE_COLORS: Record<string, string> = {
  workshop: 'bg-[#E5F7A3] text-[#3B5400] dark:bg-[#3B5400]/40 dark:text-[#E5F7A3]',
  play: 'bg-[#FDE8B3] text-[#7A4B00] dark:bg-[#7A4B00]/40 dark:text-[#FDE8B3]',
  esports: 'bg-[#D2EBF7] text-[#144C69] dark:bg-[#144C69]/40 dark:text-[#D2EBF7]',
  exhibition: 'bg-[#CEF2E4] text-[#125C43] dark:bg-[#125C43]/40 dark:text-[#CEF2E4]',
  magic: 'bg-[#E8D9FB] text-[#502784] dark:bg-[#502784]/40 dark:text-[#E8D9FB]',
  conference: 'bg-[#D8DFFB] text-[#2A3B8C] dark:bg-[#2A3B8C]/40 dark:text-[#D8DFFB]',
  dance: 'bg-[#FCD8E3] text-[#861D43] dark:bg-[#861D43]/40 dark:text-[#FCD8E3]',
  other: 'bg-[#E8EAF0] text-[#3C4353] dark:bg-[#3C4353]/40 dark:text-[#E8EAF0]',
  opera: 'bg-[#FCE2D4] text-[#89320F] dark:bg-[#89320F]/40 dark:text-[#FCE2D4]',
  circus: 'bg-[#FCDAD6] text-[#811C13] dark:bg-[#811C13]/40 dark:text-[#FCDAD6]',
  musical: 'bg-[#FAD3E7] text-[#841953] dark:bg-[#841953]/40 dark:text-[#FAD3E7]',
  festival: 'bg-[#FDEAC2] text-[#6F4A00] dark:bg-[#6F4A00]/40 dark:text-[#FDEAC2]',
  movie: 'bg-[#D7E8F7] text-[#1A466C] dark:bg-[#1A466C]/40 dark:text-[#D7E8F7]',
  concert: 'bg-[#ECD3F2] text-[#611E74] dark:bg-[#611E74]/40 dark:text-[#ECD3F2]',
  sports: 'bg-[#D0ECDA] text-[#1A552F] dark:bg-[#1A552F]/40 dark:text-[#D0ECDA]',
  standup: 'bg-[#FDE8B3] text-[#7A4B00] dark:bg-[#7A4B00]/40 dark:text-[#FDE8B3]',
};

interface EventCardProps {
  event: {
    id: string;
    title: string;
    type: string;
    poster_url?: string;
    venue_name?: string;
    city?: string;
    next_show_starts?: string;
    min_price?: number;
    max_price?: number;
  };
}

export default function EventCard({ event }: EventCardProps) {
  const typeKey = (event.type || 'other').toLowerCase();
  const colorClass = EVENT_TYPE_COLORS[typeKey] ?? EVENT_TYPE_COLORS.other;

  return (
    <Link
      to={`/events/${event.id}`}
      id={`event-card-${event.id}`}
      className="group block rounded-[24px] sm:rounded-[28px] overflow-hidden bg-[#F7F7F4] dark:bg-[#181A20] border border-slate-200/70 dark:border-slate-800 p-3 sm:p-3.5 flex flex-col justify-between hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
    >
      <div>
        {/* Poster Container */}
        <div className="relative h-48 sm:h-52 w-full rounded-2xl overflow-hidden bg-slate-900">
          {event.poster_url ? (
            <img
              src={event.poster_url}
              alt={event.title}
              className="w-full h-full object-cover grayscale contrast-[1.05] group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center">
              <Ticket size={44} className="text-slate-600" />
            </div>
          )}
          {/* Category Pill Badge */}
          <span className={`absolute top-3 left-3 px-3 py-0.5 rounded-full text-[11px] font-bold capitalize tracking-wide shadow-xs ${colorClass}`}>
            {event.type}
          </span>
        </div>

        {/* Info */}
        <div className="pt-3.5 px-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
            {event.title}
          </h3>

          <div className="mt-1.5 space-y-1">
            {(event.venue_name || event.city) && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <MapPin size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{event.venue_name}{event.city ? `, ${event.city}` : ''}</span>
              </div>
            )}
            {event.next_show_starts && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <Calendar size={13} className="text-slate-400 shrink-0" />
                <span>{formatIST(event.next_show_starts)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Price & Arrow Action Button */}
      <div className="pt-4 px-1 flex items-center justify-between mt-2 border-t border-slate-200/40 dark:border-slate-800/60">
        <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          {event.min_price != null
            ? event.min_price === event.max_price
              ? `₹${Number(event.min_price).toFixed(2)}`
              : `₹${Number(event.min_price).toFixed(2)} – ₹${Number(event.max_price).toFixed(2)}`
            : 'Free'}
        </span>

        {/* Vibrant Lime Action Button */}
        <div className="w-8 h-8 rounded-full bg-[#D4F63B] text-slate-950 flex items-center justify-center group-hover:scale-110 group-hover:bg-[#c2e42e] transition-all shadow-sm">
          <ArrowRight size={15} className="stroke-[2.5]" />
        </div>
      </div>
    </Link>
  );
}
