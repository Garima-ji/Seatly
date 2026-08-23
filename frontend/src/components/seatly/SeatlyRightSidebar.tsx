import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Scan,
  Calendar,
  Heart,
  HelpCircle,
  ChevronRight,
  ArrowRight,
  PanelRightClose,
  Ticket
} from 'lucide-react';
import SparkleIcon from './SparkleIcon';
import { useAuthStore } from '../../store';
import { customerApi } from '../../api';
import { formatIST } from '../../utils/format';

interface SeatlyRightSidebarProps {
  onCollapse?: () => void;
  onClose?: () => void;
}

export default function SeatlyRightSidebar({ onCollapse, onClose }: SeatlyRightSidebarProps) {
  const { user } = useAuthStore();

  // If logged in as customer, fetch their real bookings
  const { data: orders = [] } = useQuery({
    queryKey: ['orders', 'sidebar'],
    queryFn: customerApi.getOrders,
    enabled: !!user && user.role === 'customer',
    staleTime: 30000,
  });

  const latestOrder = orders.length > 0 ? orders[0] : null;
  const confirmedCount = latestOrder?.bookings?.filter((b: any) => b.status === 'confirmed').length ?? 0;

  const handleActionClick = () => {
    onClose?.();
  };

  return (
    <aside className="w-80 shrink-0 flex flex-col justify-between py-6 px-4 space-y-6 select-none">
      {/* Top Section */}
      <div className="space-y-5">
        {/* Header: My Booking + Notification Bell + Collapse Action */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              My Booking
            </h2>
            <SparkleIcon size={13} className="text-slate-400" />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => alert('No new notifications')}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors relative"
            >
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#D4F63B]" />
            </button>

            {/* Desktop Collapse Trigger */}
            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                aria-label="Collapse right sidebar"
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title="Collapse Panel"
              >
                <PanelRightClose size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Live Booking Card if user has bookings, otherwise curated featured booking */}
        {latestOrder ? (
          <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 shadow-sm p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#EAF8E5] text-[#2C8022] text-[10px] font-extrabold uppercase tracking-wider">
                  CONFIRMED
                </span>

                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                  {latestOrder.event_title}
                </h3>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 pt-1">
                  <p>{formatIST(latestOrder.starts_at)}</p>
                  <p>{latestOrder.venue_name}, {latestOrder.city}</p>
                </div>

                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 pt-1">
                  {confirmedCount} Seat{confirmedCount !== 1 ? 's' : ''} • Ref: {latestOrder.booking_ref}
                </p>
              </div>

              <div className="relative shrink-0 w-16 h-16 rounded-2xl overflow-hidden bg-slate-900 border border-slate-100 flex items-center justify-center">
                <Ticket size={24} className="text-[#D4F63B]" />
                <div className="absolute top-1 right-1 p-0.5 rounded-full bg-[#D4F63B]">
                  <SparkleIcon size={10} className="text-slate-950" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Link
                to={`/orders/${latestOrder.id}`}
                onClick={handleActionClick}
                className="flex-1 py-2 rounded-xl bg-[#F5F2EB] dark:bg-slate-700/70 hover:bg-[#eae5da] dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold text-center transition-colors shadow-sm"
              >
                View Ticket & QR
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 shadow-sm p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#EAF8E5] text-[#2C8022] text-[10px] font-extrabold uppercase tracking-wider">
                  UPCOMING
                </span>

                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                  Diljit Dosanjh
                  <br />
                  India Tour 2024
                </h3>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 pt-1">
                  <p>25 May 2024 • 07:00 PM</p>
                  <p>JLN Stadium, Delhi</p>
                </div>

                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 pt-1">
                  3 Seats • K12, K13, K14
                </p>
              </div>

              {/* Thumbnail with star sticker */}
              <div className="relative shrink-0 w-16 h-16 rounded-2xl overflow-hidden bg-slate-900 border border-slate-100">
                <img
                  src="/assets/banners/diljit-booking-thumb.png"
                  alt="Diljit Dosanjh"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                    (e.target as HTMLElement).nextElementSibling?.classList.remove('hidden');
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="hidden w-full h-full bg-gradient-to-tr from-slate-900 to-slate-700 flex items-center justify-center text-white text-[10px] font-bold">
                  Diljit
                </div>

                {/* Star Sticker */}
                <div className="absolute top-1 right-1 p-0.5 rounded-full bg-[#D4F63B]">
                  <SparkleIcon size={10} className="text-slate-950" />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <Link
                to="/bookings"
                onClick={handleActionClick}
                className="flex-1 py-2 rounded-xl bg-[#F5F2EB] dark:bg-slate-700/70 hover:bg-[#eae5da] dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold text-center transition-colors shadow-sm"
              >
                View Bookings
              </Link>

              <button
                type="button"
                aria-label="Show QR Code"
                onClick={() => alert('Sample QR Ticket preview for upcoming show')}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <Scan size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions List Card */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-xs text-slate-900 dark:text-white px-1">
            Quick Actions
          </h3>

          <div className="space-y-1">
            <QuickActionItem
              icon={<SparkleIcon size={14} className="text-slate-500" />}
              title="Browse Events"
              subtitle="Discover upcoming events"
              href="/events"
              onClick={handleActionClick}
            />
            <QuickActionItem
              icon={<Calendar size={14} className="text-slate-500" />}
              title="My Bookings"
              subtitle="View your bookings & tickets"
              href="/bookings"
              onClick={handleActionClick}
            />
            <QuickActionItem
              icon={<Heart size={14} className="text-slate-500" />}
              title="Waitlists"
              subtitle="Queued ticket alerts"
              href="/waitlist"
              onClick={handleActionClick}
            />
            <QuickActionItem
              icon={<HelpCircle size={14} className="text-slate-500" />}
              title="Explore Movies"
              subtitle="Find top trending films"
              href="/events?type=movie"
              onClick={handleActionClick}
            />
          </div>
        </div>

        {/* Experience Promo Bento Card (Dark) */}
        <div className="relative overflow-hidden rounded-3xl bg-[#121316] text-white p-5 space-y-4 shadow-md">
          {/* Spotlight Cone & Graphic */}
          <div className="absolute right-0 top-0 bottom-0 w-36 overflow-hidden pointer-events-none opacity-40">
            <svg viewBox="0 0 100 150" className="w-full h-full">
              <polygon points="50,0 0,150 100,150" fill="url(#promo-spotlight)" />
              <defs>
                <linearGradient id="promo-spotlight" x1="0.5" y1="0" x2="0.5" y2="1">
                  <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#fff" stopOpacity="0.05" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute top-6 right-6">
              <SparkleIcon size={18} className="text-[#D4F63B]" />
            </div>
          </div>

          <div className="relative z-10 space-y-1">
            <h3 className="text-base font-extrabold tracking-tight leading-snug">
              Don't just watch.
              <br />
              <span className="font-serif italic font-normal text-[#E8FC82]">
                Feel it live.
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Book early. Sit closer.
            </p>
          </div>

          <div className="relative z-10 pt-2">
            <Link
              to="/events"
              onClick={handleActionClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D4F63B] hover:bg-[#c6e828] text-slate-950 text-xs font-extrabold transition-transform hover:scale-105 shadow-sm"
            >
              <span>Explore Events</span>
              <ArrowRight size={13} className="stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer Copyright */}
      <div className="flex items-center justify-between px-2 pt-4 text-[11px] text-slate-400">
        <span>© 2024 seatly. All rights reserved.</span>
        <SparkleIcon size={12} className="text-slate-400" />
      </div>
    </aside>
  );
}

function QuickActionItem({
  icon,
  title,
  subtitle,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  href: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={href}
      onClick={onClick}
      className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug group-hover:text-[#6A4FE2] dark:group-hover:text-[#D4F63B] transition-colors">
            {title}
          </p>
          <p className="text-[10px] text-slate-400 font-medium">{subtitle}</p>
        </div>
      </div>
      <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}
