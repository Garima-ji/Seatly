import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { waitlistApi } from '../api';
import { formatIST } from '../utils/format';
import { CountdownTimer } from '../components/SeatMap';
import SparkleIcon from '../components/seatly/SparkleIcon';

export default function WaitlistPage() {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['waitlist-my'],
    queryFn: waitlistApi.myWaitlists,
    refetchInterval: 30000,
  });

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <SparkleIcon size={20} className="text-[#D4F63B]" />
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          My Waitlists
        </h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-3xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <Clock size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-400 font-semibold text-sm">You're not on any waitlists.</p>
          <Link to="/events" className="text-slate-950 dark:text-[#D4F63B] font-bold text-xs mt-2 inline-block underline">
            Browse events →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry: Record<string, unknown>) => (
            <div key={entry.id as string} className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-extrabold text-slate-900 dark:text-white text-base">{entry.event_title as string}</h2>
                  <p className="text-xs text-slate-500 mt-1 font-medium">{formatIST(entry.starts_at as string)} · {entry.venue_name as string}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color_hex as string }} />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{entry.category_name as string}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {entry.status === 'offered' ? (
                    <div className="space-y-2">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#D4F63B] text-slate-950 uppercase tracking-wider">
                        Seat Offered!
                      </span>
                      {entry.offer_expires_at ? (
                        <div>
                          <p className="text-[10px] text-slate-400">Expires in:</p>
                          <CountdownTimer expiresAt={entry.offer_expires_at as string} />
                        </div>
                      ) : null}
                      <Link
                        to={`/shows/${entry.show_id}`}
                        className="px-4 py-2 rounded-full bg-[#121316] text-white hover:bg-black text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                      >
                        <span>Complete Booking</span>
                        <ArrowRight size={12} className="text-[#D4F63B]" />
                      </Link>
                    </div>
                  ) : (
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Position #{entry.position as number}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
