import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Film,
  Music2,
  Trophy,
  CalendarDays,
  Shield,
  User,
  Bell,
  ChevronDown,
  ArrowRight,
  Sun,
  Moon,
  LogOut,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Gift
} from 'lucide-react';
import SparkleIcon from './SparkleIcon';
import { useAuthStore, useThemeStore } from '../../store';
import { authApi } from '../../api';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number | string; className?: string; fill?: string }>;
  matchFn?: (pathname: string, search: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'Home',
    href: '/',
    icon: () => <SparkleIcon size={16} fill="currentColor" />,
    matchFn: (p) => p === '/',
  },
  {
    name: 'Explore',
    href: '/events',
    icon: Search,
    matchFn: (p, s) => p === '/events' && !s,
  },
  {
    name: 'Movies',
    href: '/events?type=movie',
    icon: Film,
    matchFn: (p, s) => p === '/events' && s.includes('movie'),
  },
  {
    name: 'Concerts',
    href: '/events?type=concert',
    icon: Music2,
    matchFn: (p, s) => p === '/events' && s.includes('concert'),
  },
  {
    name: 'Sports',
    href: '/events?type=sports',
    icon: Trophy,
    matchFn: (p, s) => p === '/events' && s.includes('sports'),
  },
  {
    name: 'My Bookings',
    href: '/bookings',
    icon: CalendarDays,
    matchFn: (p) => p.startsWith('/bookings') || p.startsWith('/orders'),
  },
  {
    name: 'Waitlist',
    href: '/waitlist',
    icon: Shield,
    matchFn: (p) => p.startsWith('/waitlist'),
  },
];

interface SeatlySidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}

export default function SeatlySidebar({ collapsed = false, onToggleCollapse, onNavigate }: SeatlySidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const isCurrentActive = (item: NavItem) => {
    if (item.matchFn) {
      return item.matchFn(location.pathname, location.search);
    }
    return location.pathname === item.href;
  };

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch { /* ignore */ }
    clearAuth();
    setShowProfileMenu(false);
    onNavigate?.();
    navigate('/login');
  };

  const dashboardLink =
    user?.role === 'admin' ? '/admin' :
    user?.role === 'organiser' ? '/organiser' : null;

  return (
    <aside
      className={`shrink-0 flex flex-col justify-between py-6 min-h-screen select-none transition-all duration-300 ${
        collapsed ? 'w-20 px-2 items-center' : 'w-64 px-4'
      }`}
    >
      {/* Top Branding & Navigation */}
      <div className="space-y-6 w-full">
        {/* Brand Logo & Collapse Toggle */}
        <div className={`flex items-center ${collapsed ? 'justify-center flex-col gap-3' : 'justify-between px-2'}`}>
          <Link
            to="/"
            onClick={onNavigate}
            className="flex items-center gap-2.5 group"
            title="seatly"
          >
            <SparkleIcon size={24} className="text-[#D4F63B] group-hover:rotate-45 transition-transform duration-300 shrink-0" />
            {!collapsed && (
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                seatly
              </span>
            )}
          </Link>

          {/* Desktop Collapse / Expand Toggle Button */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand left sidebar' : 'Collapse left sidebar'}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          )}
        </div>

        {/* Nav Links */}
        <nav className="space-y-1 w-full">
          {NAV_ITEMS.map((item) => {
            const active = isCurrentActive(item);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={onNavigate}
                title={item.name}
                className={`flex items-center ${
                  collapsed
                    ? 'justify-center w-12 h-11 mx-auto rounded-2xl'
                    : 'justify-between px-4 py-2.5 rounded-full'
                } text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-[#141518] text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
                }`}
              >
                <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                  <Icon size={17} className={active ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                  {!collapsed && <span>{item.name}</span>}
                </div>
                {!collapsed && active && (
                  <SparkleIcon size={13} className="text-[#D4F63B]" />
                )}
              </Link>
            );
          })}

          {/* Admin / Organiser Dashboard link */}
          {dashboardLink && (
            <Link
              to={dashboardLink}
              onClick={onNavigate}
              title={`${user?.role} Portal`}
              className={`flex items-center ${
                collapsed
                  ? 'justify-center w-12 h-11 mx-auto rounded-2xl'
                  : 'justify-between px-4 py-2.5 rounded-full'
              } text-sm font-medium transition-all duration-200 ${
                location.pathname.startsWith(dashboardLink)
                  ? 'bg-[#141518] text-white shadow-md'
                  : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              }`}
            >
              <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                <LayoutDashboard size={17} />
                {!collapsed && <span className="capitalize">{user?.role} Portal</span>}
              </div>
            </Link>
          )}
        </nav>
      </div>

      {/* Bottom Section: Promo Card, User Profile, Theme Switcher */}
      <div className="space-y-3 pt-4 w-full">
        {/* Invite Friends Card (Full or Compact) */}
        {!collapsed ? (
          <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-[#EEFCAD] via-[#E2FB84] to-[#D5F865] text-slate-950 shadow-sm border border-lime-200/60">
            <div className="relative z-10 space-y-1">
              <h4 className="font-bold text-sm tracking-tight text-slate-900">
                Invite friends
              </h4>
              <p className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                Get ₹150 off <span>🎉</span>
              </p>
              <div className="pt-2">
                <button
                  onClick={() => alert('Invite link copied to clipboard!')}
                  className="w-full inline-flex items-center justify-between px-3.5 py-2 rounded-full bg-[#121316] text-white text-xs font-medium hover:bg-slate-900 transition-colors shadow-sm"
                >
                  <span>Invite Now</span>
                  <ArrowRight size={13} className="text-white" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => alert('Invite friends - Get ₹150 off! Link copied!')}
              title="Invite friends - Get ₹150 off"
              className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#EEFCAD] to-[#D5F865] text-slate-950 flex items-center justify-center shadow-xs hover:scale-105 transition-transform"
            >
              <Gift size={18} className="text-slate-950" />
            </button>
          </div>
        )}

        {/* User Profile Pill */}
        <div className="relative w-full">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            title={user?.full_name || 'Profile'}
            className={`w-full flex items-center ${
              collapsed
                ? 'justify-center p-1.5 rounded-2xl'
                : 'justify-between p-2 rounded-2xl'
            } bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 hover:shadow-sm transition-all`}
          >
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-[#D4F63B] text-slate-950 font-extrabold flex items-center justify-center text-xs shadow-xs">
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'P'}
                </div>
              </div>
              {!collapsed && (
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                    hey, {user?.full_name?.split(' ')[0]?.toLowerCase() || 'guest'} 👋
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-400 font-medium capitalize">
                    {user?.role || 'Guest'}
                  </p>
                </div>
              )}
            </div>
            {!collapsed && <ChevronDown size={14} className="text-slate-400 mr-1" />}
          </button>

          {showProfileMenu && (
            <div className={`absolute bottom-full mb-2 ${collapsed ? 'left-0 w-48' : 'left-0 right-0'} p-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 text-xs z-50 animate-fade-in`}>
              {user ? (
                <>
                  <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700 mb-1">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{user.full_name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                  </div>
                  <Link
                    to="/bookings"
                    onClick={() => { setShowProfileMenu(false); onNavigate?.(); }}
                    className="block px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium"
                  >
                    My Bookings
                  </Link>
                  <Link
                    to="/waitlist"
                    onClick={() => { setShowProfileMenu(false); onNavigate?.(); }}
                    className="block px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium"
                  >
                    My Waitlists
                  </Link>
                  {dashboardLink && (
                    <Link
                      to={dashboardLink}
                      onClick={() => { setShowProfileMenu(false); onNavigate?.(); }}
                      className="block px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium capitalize"
                    >
                      {user.role} Dashboard
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-red-50 text-red-600 dark:hover:bg-red-950/40 text-left font-medium mt-1"
                  >
                    <LogOut size={12} />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <div className="space-y-1 p-1">
                  <Link
                    to="/login"
                    onClick={() => { setShowProfileMenu(false); onNavigate?.(); }}
                    className="block text-center py-1.5 px-3 rounded-lg bg-[#121316] text-white hover:bg-black font-semibold"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => { setShowProfileMenu(false); onNavigate?.(); }}
                    className="block text-center py-1.5 px-3 rounded-lg bg-[#D4F63B] text-slate-950 hover:bg-[#c6e828] font-semibold"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Theme Switcher */}
        {!collapsed ? (
          <div className="p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-full flex items-center text-xs font-semibold">
            <button
              onClick={toggleTheme}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full transition-all duration-200 ${
                !isDark
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <Sun size={13} className={!isDark ? 'text-amber-500' : ''} />
              <span>Light</span>
            </button>

            <button
              onClick={toggleTheme}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full transition-all duration-200 ${
                isDark
                  ? 'bg-[#141518] text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <Moon size={13} className={isDark ? 'text-[#D4F63B]' : ''} />
              <span>Dark</span>
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={toggleTheme}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
              className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:shadow-xs transition-all"
            >
              {isDark ? <Moon size={15} className="text-[#D4F63B]" /> : <Sun size={15} className="text-amber-500" />}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
