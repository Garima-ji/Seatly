import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowUpRight, ArrowRight } from 'lucide-react';

export interface FeaturedEventItem {
  id: string;
  title: string;
  subtitle?: string;
  type: 'CONCERT' | 'MOVIE' | 'SPORTS' | string;
  imageSrc: string;
  dateAndVenue?: string;
  minPrice: number;
  isFavorite?: boolean;
  href?: string;
}

interface FeaturedEventCardProps {
  event: FeaturedEventItem;
  onSelect?: (event: FeaturedEventItem) => void;
}

export default function FeaturedEventCard({ event, onSelect }: FeaturedEventCardProps) {
  const [favorite, setFavorite] = useState(event.isFavorite || false);

  const getTagStyle = (type: string) => {
    switch (type.toUpperCase()) {
      case 'CONCERT':
        return 'bg-purple-100/90 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300';
      case 'MOVIE':
        return 'bg-sky-100/90 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300';
      case 'SPORTS':
        return 'bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div
      onClick={() => onSelect?.(event)}
      className="group relative flex flex-col justify-between p-4 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Top Bar: Category Pill & Heart Icon */}
      <div className="flex items-center justify-between z-10">
        <span className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full uppercase ${getTagStyle(event.type)}`}>
          {event.type}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setFavorite(!favorite);
          }}
          aria-label="Add to wishlist"
          className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-400 hover:text-red-500 transition-colors"
        >
          <Heart
            size={16}
            className={favorite ? 'fill-red-500 text-red-500' : 'text-slate-400'}
          />
        </button>
      </div>

      {/* Center Image / Cutout */}
      <div className="relative h-32 my-1 flex items-center justify-center overflow-hidden">
        <img
          src={event.imageSrc}
          alt={event.title}
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
            (e.target as HTMLElement).nextElementSibling?.classList.remove('hidden');
          }}
          className="h-full max-h-32 object-contain group-hover:scale-105 transition-transform duration-300 filter drop-shadow-md"
        />

        {/* Fallback stylized artwork if photo is not yet provided */}
        <div className="hidden w-24 h-24 rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-400 text-xs font-semibold">
          {event.title.split(' ')[0]}
        </div>
      </div>

      {/* Bottom Info: Title, Subtitle, Date, Price & Lime Action Arrow */}
      <div className="space-y-1 pt-1 z-10">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
            {event.title}
          </h3>
          {event.subtitle && (
            <p className="font-serif italic text-xs text-slate-500 dark:text-slate-400">
              {event.subtitle}
            </p>
          )}
        </div>

        {event.dateAndVenue && (
          <p className="text-[11px] text-slate-400 dark:text-slate-400 font-medium truncate">
            {event.dateAndVenue}
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            From <span className="font-extrabold">₹{event.minPrice.toLocaleString()}</span>
          </span>

          <Link
            to={event.href || `/events/${event.id}`}
            onClick={(e) => e.stopPropagation()}
            className="w-8 h-8 rounded-full bg-[#D4F63B] hover:bg-[#c6e828] text-slate-950 flex items-center justify-center transition-all duration-200 group-hover:scale-110 shadow-sm"
          >
            <ArrowRight size={14} className="stroke-[2.5]" />
          </Link>
        </div>
      </div>
    </div>
  );
}
