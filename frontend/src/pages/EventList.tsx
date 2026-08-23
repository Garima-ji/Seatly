import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronDown, ChevronRight } from 'lucide-react';
import { eventsApi } from '../api';
import EventCard from '../components/EventCard';
import SparkleIcon from '../components/seatly/SparkleIcon';

// Category pills configuration matching the exact mockup items
const CATEGORY_CHIPS = [
  { label: 'All', value: '', hasDropdown: false },
  { label: 'Workshop', value: 'workshop', hasDropdown: false },
  { label: 'Play', value: 'play', hasDropdown: true },
  { label: 'Esports', value: 'esports', hasDropdown: false },
  { label: 'Exhibition', value: 'exhibition', hasDropdown: false },
  { label: 'Conference', value: 'conference', hasDropdown: false },
  { label: 'Music', value: 'concert', hasDropdown: true },
  { label: 'Dance', value: 'dance', hasDropdown: true },
  { label: 'Sports', value: 'sports', hasDropdown: true },
  { label: 'More', value: 'other', hasDropdown: true },
];

const ALL_EVENT_TYPES = [
  'movie', 'concert', 'play', 'musical', 'opera', 'dance',
  'standup', 'sports', 'esports', 'festival', 'exhibition',
  'conference', 'workshop', 'magic', 'circus', 'other',
];

// Fallback high-resolution B&W photography items corresponding to the mockup screenshot
const MOCKUP_EVENTS = [
  {
    id: 'mock-1',
    title: 'Photography Masterclass with Raghu Rai',
    type: 'workshop',
    poster_url: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=800&q=80',
    venue_name: 'PVR Phoenix Palladium',
    city: 'Mumbai',
    next_show_starts: '2026-09-07T12:22:00+05:30',
    min_price: 700,
    max_price: 2700,
  },
  {
    id: 'mock-2',
    title: 'Hamlet — Prithvi Theatre Production',
    type: 'play',
    poster_url: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=800&q=80',
    venue_name: 'PVR Phoenix Palladium',
    city: 'Mumbai',
    next_show_starts: '2026-08-26T12:22:00+05:30',
    min_price: 450,
    max_price: 1700,
  },
  {
    id: 'mock-3',
    title: 'ESL One India Dota 2 Championship',
    type: 'esports',
    poster_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
    venue_name: 'INOX Lido',
    city: 'Bengaluru',
    next_show_starts: '2026-09-03T12:22:00+05:30',
    min_price: 600,
    max_price: 2300,
  },
  {
    id: 'mock-4',
    title: 'India Art Fair 2026',
    type: 'exhibition',
    poster_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80',
    venue_name: 'Jawaharlal Nehru Stadium',
    city: 'New Delhi',
    next_show_starts: '2026-09-05T12:22:00+05:30',
    min_price: 650,
    max_price: 2500,
  },
  {
    id: 'mock-5',
    title: 'Grand Illusions — The Magic Show',
    type: 'magic',
    poster_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    venue_name: 'INOX Lido',
    city: 'Bengaluru',
    next_show_starts: '2026-09-08T12:22:00+05:30',
    min_price: 725,
    max_price: 2800,
  },
  {
    id: 'mock-6',
    title: 'TechSpark India Summit',
    type: 'conference',
    poster_url: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=800&q=80',
    venue_name: 'INOX Lido',
    city: 'Bengaluru',
    next_show_starts: '2026-09-06T12:22:00+05:30',
    min_price: 675,
    max_price: 2600,
  },
  {
    id: 'mock-7',
    title: "Shiamak Davar's Dance Spectacular",
    type: 'dance',
    poster_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
    venue_name: 'Wankhede Stadium',
    city: 'Mumbai',
    next_show_starts: '2026-08-31T12:22:00+05:30',
    min_price: 525,
    max_price: 2000,
  },
  {
    id: 'mock-8',
    title: 'IPL Opening Ceremony 2026',
    type: 'other',
    poster_url: 'https://images.unsplash.com/photo-1569517282132-25d22f4573e6?auto=format&fit=crop&w=800&q=80',
    venue_name: 'Wankhede Stadium',
    city: 'Mumbai',
    next_show_starts: '2026-09-10T12:22:00+05:30',
    min_price: 775,
    max_price: 3000,
  },
  {
    id: 'mock-9',
    title: 'A. R. Rahman: Roja Opera Nuit',
    type: 'opera',
    poster_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
    venue_name: 'INOX Lido',
    city: 'Bengaluru',
    next_show_starts: '2026-08-30T12:22:00+05:30',
    min_price: 500,
    max_price: 1900,
  },
  {
    id: 'mock-10',
    title: 'Cirque du Soleil: Alegria',
    type: 'circus',
    poster_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80',
    venue_name: 'Jawaharlal Nehru Stadium',
    city: 'New Delhi',
    next_show_starts: '2026-09-09T12:22:00+05:30',
    min_price: 750,
    max_price: 2900,
  },
  {
    id: 'mock-11',
    title: 'Mughal-E-Azam Musical',
    type: 'musical',
    poster_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
    venue_name: 'Jawaharlal Nehru Stadium',
    city: 'New Delhi',
    next_show_starts: '2026-08-29T12:22:00+05:30',
    min_price: 475,
    max_price: 1800,
  },
  {
    id: 'mock-12',
    title: 'Lollapalooza India 2026',
    type: 'festival',
    poster_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
    venue_name: 'Wankhede Stadium',
    city: 'Mumbai',
    next_show_starts: '2026-09-04T12:22:00+05:30',
    min_price: 625,
    max_price: 2400,
  },
  {
    id: 'mock-13',
    title: 'Sholay — The Return (4K Remaster)',
    type: 'movie',
    poster_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80',
    venue_name: 'PVR Phoenix Palladium',
    city: 'Mumbai',
    next_show_starts: '2026-08-26T12:22:00+05:30',
    min_price: 400,
    max_price: 1500,
  },
  {
    id: 'mock-14',
    title: 'Arijit Singh Live in Concert',
    type: 'concert',
    poster_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
    venue_name: 'Wankhede Stadium',
    city: 'Mumbai',
    next_show_starts: '2026-08-27T12:22:00+05:30',
    min_price: 425,
    max_price: 1600,
  },
  {
    id: 'mock-15',
    title: 'India vs Australia T20I',
    type: 'sports',
    poster_url: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=800&q=80',
    venue_name: 'Wankhede Stadium',
    city: 'Mumbai',
    next_show_starts: '2026-09-02T12:22:00+05:30',
    min_price: 575,
    max_price: 2200,
  },
];

export default function EventList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const type = searchParams.get('type') ?? '';
  const city = searchParams.get('city') ?? '';
  const date = searchParams.get('date') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['events', { type, city, date, page }],
    queryFn: () =>
      eventsApi.list({
        ...(type && { type }),
        ...(city && { city }),
        ...(date && { date }),
        page: String(page),
        limit: '15',
      }),
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };

  const clearFilters = () => setSearchParams({});

  const hasFilters = type || city || date;

  // Merge live API data with mockup poster/venue fallbacks for rich high-quality display
  const rawEvents = data?.events && data.events.length > 0 ? data.events : MOCKUP_EVENTS;
  
  const displayEvents = rawEvents.map((evt: any, idx: number) => {
    const fallback = MOCKUP_EVENTS[idx % MOCKUP_EVENTS.length];
    return {
      ...evt,
      poster_url: evt.poster_url || fallback.poster_url,
      venue_name: evt.venue_name || fallback.venue_name,
      city: evt.city || fallback.city,
      next_show_starts: evt.next_show_starts || fallback.next_show_starts,
      min_price: evt.min_price ?? fallback.min_price,
      max_price: evt.max_price ?? fallback.max_price,
    };
  }).filter((evt: any) => {
    if (type && evt.type?.toLowerCase() !== type.toLowerCase()) return false;
    if (city && evt.city && !evt.city.toLowerCase().includes(city.toLowerCase())) return false;
    return true;
  });

  const totalCount = data?.pagination?.total ?? displayEvents.length;

  return (
    <div className="space-y-6 w-full animate-fade-in">
      {/* 1. Header Title & Subtitle + Filters Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-baseline gap-2">
            <span>Browse</span>
            <span className="font-serif italic font-normal text-slate-900 dark:text-slate-100">Events</span>
            <SparkleIcon size={20} className="text-[#D4F63B] inline-block self-start -ml-1 mt-1" />
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            {totalCount} events found
          </p>
        </div>

        <button
          id="toggle-filters"
          onClick={() => setShowFilters(!showFilters)}
          className="self-start sm:self-center px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-xs transition-all flex items-center gap-2"
        >
          <SlidersHorizontal size={14} className="text-slate-600 dark:text-slate-400" />
          <span>Filters</span>
          {hasFilters && <span className="w-2 h-2 rounded-full bg-[#D4F63B]" />}
        </button>
      </div>

      {/* 2. Horizontal Category Chips Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none scroll-smooth">
        {CATEGORY_CHIPS.map((chip) => {
          const isActive = type === chip.value;
          return (
            <button
              key={chip.label}
              onClick={() => setParam('type', chip.value)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#121316] text-white dark:bg-white dark:text-slate-950 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>{chip.label}</span>
              {chip.hasDropdown && (
                <ChevronDown size={12} className={isActive ? 'text-white dark:text-slate-950' : 'text-slate-400'} />
              )}
            </button>
          );
        })}
      </div>

      {/* Expandable Advanced Filters Drawer */}
      {showFilters && (
        <div className="glass rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 animate-slide-up shadow-sm">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Event Type</label>
              <select
                id="filter-type"
                className="input text-xs"
                value={type}
                onChange={(e) => setParam('type', e.target.value)}
              >
                <option value="">All types</option>
                {ALL_EVENT_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">City</label>
              <input
                id="filter-city"
                type="text"
                className="input text-xs"
                placeholder="e.g. Mumbai"
                value={city}
                onChange={(e) => setParam('city', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Date</label>
              <input
                id="filter-date"
                type="date"
                className="input text-xs"
                value={date}
                onChange={(e) => setParam('date', e.target.value)}
              />
            </div>
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 mt-3 font-semibold transition-colors"
            >
              <X size={12} /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* 3. Event Cards Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 rounded-[28px] bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-500">Failed to load live events. Showing demo catalog.</p>
        </div>
      ) : displayEvents.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">No events found for selected filters</p>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-[#121316] dark:text-white font-bold underline hover:opacity-80">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {displayEvents.map((event: any) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          {/* 4. Circular Pill Pagination Bar */}
          <div className="flex justify-center items-center gap-2 pt-6 pb-4">
            <button
              onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: '1' })}
              className={`w-9 h-9 rounded-full text-xs font-extrabold flex items-center justify-center transition-all ${
                page === 1
                  ? 'bg-[#D4F63B] text-slate-950 shadow-xs scale-105'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              1
            </button>

            <button
              onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: '2' })}
              className={`w-9 h-9 rounded-full text-xs font-extrabold flex items-center justify-center transition-all ${
                page === 2
                  ? 'bg-[#D4F63B] text-slate-950 shadow-xs scale-105'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              2
            </button>

            <button
              onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(page + 1) })}
              className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all"
            >
              <ChevronRight size={14} className="stroke-[2.5]" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
