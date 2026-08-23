import React, { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import SparkleIcon from './SparkleIcon';
import { useNavigate } from 'react-router-dom';

interface SeatlyHeroProps {
  onSearch?: (query: string) => void;
  onFilterClick?: () => void;
}

export default function SeatlyHero({ onSearch, onFilterClick }: SeatlyHeroProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    } else {
      navigate(`/events?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <section className="relative w-full pt-4 pb-2">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
        {/* Left Column: Headlines & Search */}
        <div className="flex-1 max-w-xl space-y-5">
          {/* Main Headline */}
          <div className="space-y-1">
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.08]">
              <span className="relative inline-block">
                <span className="relative z-10">Good plans.</span>
                <span className="absolute -bottom-1 left-0 w-full h-3.5 bg-[#E8FC82] dark:bg-[#d4f63b]/30 rounded-full -z-0 opacity-80" />
              </span>
              <br />
              <span className="font-serif italic font-normal text-slate-800 dark:text-slate-100">
                Great memories.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-normal pt-1">
              Book tickets for movies, concerts and live events.
            </p>
          </div>

          {/* Search & Filter Pill Bar */}
          <form onSubmit={handleSearchSubmit} className="relative flex items-center max-w-md w-full">
            <div className="relative w-full flex items-center bg-white dark:bg-slate-800/90 rounded-full border border-slate-200/80 dark:border-slate-700 shadow-sm hover:border-slate-300 transition-all p-1.5 pl-4">
              <Search size={18} className="text-slate-400 shrink-0 mr-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, events, venues..."
                className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={onFilterClick || (() => navigate('/events'))}
                aria-label="Filter events"
                className="w-9 h-9 rounded-full bg-[#121316] hover:bg-slate-900 text-white flex items-center justify-center shrink-0 transition-colors shadow-sm"
              >
                <SlidersHorizontal size={15} />
              </button>
            </div>
          </form>
        </div>

        {/* Right Graphic: Organic Mask Blob with Concert Visual & Neon Star Overlays */}
        <div className="relative shrink-0 w-72 sm:w-80 h-56 sm:h-64 flex items-center justify-center">
          {/* Black sparkle star (top-left) */}
          <div className="absolute top-24 left-2 z-20">
            <SparkleIcon size={14} className="text-slate-900 dark:text-white" />
          </div>

          {/* Top Lime Sparkle Star */}
          <div className="absolute top-0 left-28 z-20 animate-pulse">
            <SparkleIcon size={26} className="text-[#D4F63B]" />
          </div>

          {/* Right Lime Sparkle Star */}
          <div className="absolute bottom-16 right-0 z-20">
            <SparkleIcon size={16} className="text-[#D4F63B]" />
          </div>

          {/* Neon wireframe loop line */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            viewBox="0 0 320 256"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M 60 120 C 50 40, 240 20, 260 90 C 280 170, 180 240, 100 210 C 30 180, 70 140, 130 160 C 200 180, 270 140, 240 70"
              stroke="#D4F63B"
              strokeWidth="1.2"
              strokeDasharray="4 2"
              className="opacity-75"
            />
            <ellipse
              cx="190"
              cy="150"
              rx="60"
              ry="45"
              transform="rotate(25 190 150)"
              stroke="#D4F63B"
              strokeWidth="1.2"
              className="opacity-60"
            />
          </svg>

          {/* Liquid Blob Mask Container */}
          <div
            className="relative w-64 sm:w-72 h-48 sm:h-56 overflow-hidden bg-slate-900 shadow-xl"
            style={{
              borderRadius: '62% 38% 70% 30% / 45% 58% 42% 55%',
              border: '2px solid rgba(255,255,255,0.4)',
            }}
          >
            <img
              src="/assets/hero/hero-concert-crowd.png"
              alt="Live Concert Crowd"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
                (e.target as HTMLElement).nextElementSibling?.classList.remove('hidden');
              }}
              className="w-full h-full object-cover grayscale contrast-125"
            />

            {/* Elegant Fallback Graphic if Image is Not Yet Placed */}
            <div className="hidden w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-black flex items-center justify-center p-4">
              <svg viewBox="0 0 200 150" className="w-full h-full opacity-80" fill="none">
                {/* Silhouette Crowd & Hands */}
                <path d="M 0 150 L 0 120 Q 30 100, 60 130 T 120 110 T 170 125 T 200 115 L 200 150 Z" fill="#222" />
                <path d="M 40 120 L 45 85 L 50 120 Z" fill="#333" />
                <path d="M 80 130 L 85 70 L 92 130 Z" fill="#444" />
                <path d="M 130 125 L 140 60 L 148 125 Z" fill="#333" />
                <path d="M 165 120 L 172 80 L 178 120 Z" fill="#444" />
                {/* Spotlight Rays */}
                <polygon points="100,0 30,150 170,150" fill="url(#hero-spotlight)" opacity="0.35" />
                <defs>
                  <linearGradient id="hero-spotlight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4F63B" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#D4F63B" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
