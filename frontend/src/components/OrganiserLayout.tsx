import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, LogOut, Ticket } from 'lucide-react';
import { useAuthStore } from '../store';
import { authApi } from '../api';
import ThemeToggle from './ThemeToggle';

import SparkleIcon from './seatly/SparkleIcon';

const nav = [
  { to: '/organiser', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/organiser/events', label: 'My Events', icon: Calendar },
];

export default function OrganiserLayout() {
  const { user, clearAuth, refreshToken } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignore */ }
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 glass border-r border-slate-200/50 dark:border-slate-700/50 flex flex-col py-6">
        <div className="px-5 mb-8">
          <div className="flex items-center gap-2">
            <SparkleIcon size={20} className="text-[#D4F63B]" />
            <span className="text-base font-extrabold text-slate-900 dark:text-white lowercase tracking-tight">seatly</span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">Organiser Panel</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-amber-100/70 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-semibold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
          <div className="px-3 mb-4">
            <ThemeToggle />
          </div>
          <div className="px-3 mb-2">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user?.full_name}</p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors">
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
