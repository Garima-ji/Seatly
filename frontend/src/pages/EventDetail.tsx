import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Calendar, ArrowRight, Tag } from 'lucide-react';
import { eventsApi } from '../api';
import { formatIST, formatINR } from '../utils/format';
import SparkleIcon from '../components/seatly/SparkleIcon';

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.get(id!),
    enabled: !!id,
    retry: 1,
  });

  if (isLoading) return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="h-72 rounded-3xl bg-slate-200/70 dark:bg-slate-800/70" />
      <div className="h-8 rounded bg-slate-200/70 dark:bg-slate-800/70 w-2/3" />
      <div className="h-4 rounded bg-slate-200/70 dark:bg-slate-800/70 w-1/2" />
    </div>
  );

  if (isError || !data) {
    const isNotFound = (error as { response?: { status?: number } })?.response?.status === 404;
    return (
      <div className="text-center py-20 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
        <p className="text-slate-700 dark:text-slate-300 font-bold text-lg mb-2">
          {isNotFound ? 'Event not found.' : 'Unable to load event details.'}
        </p>
        <p className="text-sm text-slate-500 mb-6">
          {isNotFound ? 'The event you are looking for does not exist or has been removed.' : 'Please check your connection and try again.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          {!isNotFound && (
            <button onClick={() => refetch()} className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100">
              Try Again
            </button>
          )}
          <Link to="/events" className="px-4 py-2 rounded-full bg-[#121316] text-white text-xs font-semibold hover:bg-black">
            ← Browse events
          </Link>
        </div>
      </div>
    );
  }

  const event = data;

  return (
    <div className="w-full animate-fade-in space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 flex items-center gap-2">
        <Link to="/" className="hover:text-slate-900 dark:hover:text-white font-medium">Home</Link>
        <span>/</span>
        <Link to="/events" className="hover:text-slate-900 dark:hover:text-white font-medium">Events</Link>
        <span>/</span>
        <span className="text-slate-900 dark:text-white font-bold">{event.title}</span>
      </nav>

      <div className="grid md:grid-cols-5 gap-8">
        {/* Poster */}
        <div className="md:col-span-2">
          <div className="aspect-[2/3] rounded-3xl overflow-hidden bg-slate-900 shadow-lg border border-slate-200/60 dark:border-slate-800">
            {event.poster_url ? (
              <img src={event.poster_url} alt={event.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                <Tag size={48} className="text-slate-600" />
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="md:col-span-3 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#D4F63B] text-slate-950 capitalize">
            <SparkleIcon size={12} />
            <span>{event.type}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {event.title}
          </h1>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <MapPin size={14} className="text-[#D4F63B]" />
            <span>{event.venue_name}, {event.city}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{event.address}</p>

          {event.description && (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-2">
              {event.description}
            </p>
          )}

          {/* Shows list */}
          <div className="pt-4 space-y-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Available Shows</h2>
            {event.shows?.length > 0 ? (
              <div className="space-y-3">
                {event.shows.map((show: Record<string, unknown>) => {
                  const cats = (show.categories as Record<string, unknown>[]) ?? [];
                  const hasSeats = cats.some((c: Record<string, unknown>) => Number(c.available_count) > 0);

                  return (
                    <div key={show.id as string} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                            <Calendar size={14} className="text-slate-400" />
                            {formatIST(show.starts_at as string)}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {cats.map((c: Record<string, unknown>) => (
                              <span key={c.category_id as string} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                <span className="w-2 h-2 rounded-full" style={{ background: c.color_hex as string }} />
                                {c.category_name as string}: {formatINR(Number(c.price))}
                                <span className="text-slate-400 text-[11px]">({c.available_count as string} left)</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <Link
                          to={`/shows/${show.id}`}
                          id={`show-${show.id}-book`}
                          className="shrink-0 px-4 py-2 rounded-full bg-[#121316] text-white hover:bg-black text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <span>{hasSeats ? 'Select Seats' : 'Join Waitlist'}</span>
                          <ArrowRight size={12} className="text-[#D4F63B]" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-400 text-xs">No upcoming shows for this event.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
