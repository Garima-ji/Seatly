import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../api';
import SparkleIcon from '../components/seatly/SparkleIcon';
import SeatlyHero from '../components/seatly/SeatlyHero';
import FeaturedEventCard, { FeaturedEventItem } from '../components/seatly/FeaturedEventCard';
import LiveSeatSelector from '../components/seatly/LiveSeatSelector';

export default function Home() {
  const navigate = useNavigate();
  const [activeMovie, setActiveMovie] = useState<{
    showId: string | null;
    title: string;
    dateTime: string;
    venue: string;
  }>({
    showId: null,
    title: 'Select an Event',
    dateTime: '',
    venue: '',
  });

  // Query events list from the backend database
  const { data: eventsRes, isLoading } = useQuery({
    queryKey: ['homeEvents'],
    queryFn: () => eventsApi.list({ limit: '6' }),
  });

  const rawEvents = eventsRes?.events ?? [];

  // Map backend events to featured events cards dynamically
  const featuredEvents: FeaturedEventItem[] = rawEvents
    .filter((e: any) => e.next_show_id)
    .slice(0, 3)
    .map((e: any) => ({
      id: e.id,
      title: e.title,
      subtitle: e.description ? e.description.split('.')[0] + '.' : undefined,
      type: e.type,
      imageSrc: e.poster_url || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&q=80',
      dateAndVenue: e.next_show_starts
        ? new Date(e.next_show_starts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' • ' + e.venue_name
        : e.venue_name,
      minPrice: Number(e.min_price || 0),
      isFavorite: false,
      href: `/events/${e.id}`,
      // Store next show details on the item
      next_show_id: e.next_show_id,
      next_show_starts: e.next_show_starts,
      venue_name: e.venue_name,
      city: e.city,
    }));

  // Automatically select the first event's show on load
  useEffect(() => {
    if (featuredEvents.length > 0 && !activeMovie.showId) {
      const first = featuredEvents[0] as any;
      setActiveMovie({
        showId: first.next_show_id,
        title: first.title,
        dateTime: new Date(first.next_show_starts).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }) + ' • India Standard Time',
        venue: `${first.venue_name}, ${first.city}`,
      });
    }
  }, [eventsRes]);

  const handleEventSelect = (item: FeaturedEventItem) => {
    const rawItem = item as any;
    if (rawItem.next_show_id) {
      setActiveMovie({
        showId: rawItem.next_show_id,
        title: rawItem.title,
        dateTime: new Date(rawItem.next_show_starts).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }) + ' • India Standard Time',
        venue: `${rawItem.venue_name}, ${rawItem.city}`,
      });
    } else {
      navigate(item.href || `/events/${item.id}`);
    }
  };

  return (
    <div className="space-y-7 max-w-4xl mx-auto w-full animate-fade-in">
      {/* 1. Hero Section with Search & Fluid Art Visual */}
      <SeatlyHero />

      {/* 2. Featured Events Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <SparkleIcon size={16} className="text-[#D4F63B]" />
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Featured Events
            </h2>
          </div>

          <Link
            to="/events"
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors"
          >
            <span>See all</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* Featured Events Grid (3-cards) */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="h-48 rounded-3xl bg-slate-200/60 dark:bg-slate-800 animate-pulse" />
            <div className="h-48 rounded-3xl bg-slate-200/60 dark:bg-slate-800 animate-pulse" />
            <div className="h-48 rounded-3xl bg-slate-200/60 dark:bg-slate-800 animate-pulse" />
          </div>
        ) : featuredEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {featuredEvents.map((event) => (
              <FeaturedEventCard
                key={event.id}
                event={event}
                onSelect={handleEventSelect}
              />
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-xs italic">No active events found. Please make sure the database is seeded.</p>
        )}
      </section>

      {/* 3. Interactive Live Cinema / Seat Booking Widget */}
      <section className="pt-1">
        {activeMovie.showId ? (
          <LiveSeatSelector
            showId={activeMovie.showId}
            movieTitle={activeMovie.title}
            dateTime={activeMovie.dateTime}
            venue={activeMovie.venue}
          />
        ) : (
          <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            Select a featured event above to load the live seat plan.
          </div>
        )}
      </section>
    </div>
  );
}
