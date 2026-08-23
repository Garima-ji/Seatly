import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Menu, X, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen, Ticket } from 'lucide-react';
import SeatlySidebar from './seatly/SeatlySidebar';
import SeatlyRightSidebar from './seatly/SeatlyRightSidebar';
import SparkleIcon from './seatly/SparkleIcon';
import ThemeToggle from './ThemeToggle';

export default function Layout() {
  const location = useLocation();
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  
  // Collapse state for desktop left sidebar (persisted in localStorage)
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('seatly_left_sidebar_collapsed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const toggleLeftSidebar = () => {
    setLeftCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('seatly_left_sidebar_collapsed', JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  // Collapse state for desktop right sidebar (persisted in localStorage)
  const [rightCollapsed, setRightCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('seatly_right_sidebar_collapsed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const toggleRightSidebar = () => {
    setRightCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('seatly_right_sidebar_collapsed', JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  // Close mobile drawers on route change
  useEffect(() => {
    setMobileLeftOpen(false);
    setMobileRightOpen(false);
  }, [location.pathname, location.search]);

  // Check if current route is /shows (where show seatmap & checkout info take over the right side)
  const isShowPage = location.pathname.startsWith('/shows');

  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-[#0E1013] text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased">
      {/* Mobile Top Header (Visible only on lg and smaller screens) */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/90 dark:bg-[#14161B]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileLeftOpen(!mobileLeftOpen)}
            aria-label="Toggle navigation menu"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            {mobileLeftOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link to="/" className="flex items-center gap-1.5 font-bold text-lg text-slate-900 dark:text-white">
            <SparkleIcon size={20} className="text-[#D4F63B]" />
            <span>seatly</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!isShowPage && (
            <button
              onClick={() => setMobileRightOpen(!mobileRightOpen)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#121316] text-white dark:bg-slate-800 hover:bg-black transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Ticket size={13} className="text-[#D4F63B]" />
              <span>My Tickets</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Left Sidebar Drawer */}
      {mobileLeftOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex animate-fade-in">
          <div className="w-72 bg-[#F7F7F5] dark:bg-[#0E1013] h-full shadow-2xl overflow-y-auto p-3 flex flex-col justify-between">
            <div className="flex justify-between items-center px-2 pb-2">
              <div className="flex items-center gap-2">
                <SparkleIcon size={20} className="text-[#D4F63B]" />
                <span className="font-bold text-lg text-slate-900 dark:text-white">seatly</span>
              </div>
              <button
                onClick={() => setMobileLeftOpen(false)}
                className="p-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <SeatlySidebar onNavigate={() => setMobileLeftOpen(false)} />
          </div>
          <div className="flex-1" onClick={() => setMobileLeftOpen(false)} />
        </div>
      )}

      {/* Mobile Right Sidebar Drawer (only when not on /shows) */}
      {!isShowPage && mobileRightOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in">
          <div className="flex-1" onClick={() => setMobileRightOpen(false)} />
          <div className="w-84 max-w-[90vw] bg-[#F7F7F5] dark:bg-[#0E1013] h-full shadow-2xl overflow-y-auto p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200/60 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <SparkleIcon size={14} className="text-[#D4F63B]" />
                <span>My Bookings & Actions</span>
              </h3>
              <button
                onClick={() => setMobileRightOpen(false)}
                className="p-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
                aria-label="Close bookings panel"
              >
                <X size={18} />
              </button>
            </div>
            <SeatlyRightSidebar onClose={() => setMobileRightOpen(false)} />
          </div>
        </div>
      )}

      {/* Main 3-Column Cockpit Container */}
      <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-row items-start justify-center relative">
        {/* Left Sidebar (Sticky Desktop & Collapsible) */}
        <div className="hidden lg:block sticky top-0 h-screen overflow-y-auto border-r border-slate-200/60 dark:border-slate-800/80 shrink-0 transition-all duration-300">
          <SeatlySidebar
            collapsed={leftCollapsed}
            onToggleCollapse={toggleLeftSidebar}
          />
        </div>

        {/* Center Main Content Area */}
        <main
          className={`flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-7 transition-all duration-300 ${
            isShowPage
              ? 'max-w-7xl'
              : rightCollapsed
              ? 'max-w-6xl'
              : 'max-w-5xl'
          }`}
        >
          {/* Top helper bar with Right Sidebar Toggle when collapsed (not needed on /shows) */}
          {!isShowPage && (
            <div className="hidden xl:flex items-center justify-end">
              <button
                onClick={toggleRightSidebar}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border shadow-xs ${
                  rightCollapsed
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title={rightCollapsed ? 'Expand Right Panel' : 'Collapse Right Panel'}
                aria-label={rightCollapsed ? 'Expand Right Panel' : 'Collapse Right Panel'}
              >
                {rightCollapsed ? (
                  <>
                    <PanelRightOpen size={15} className="text-[#D4F63B]" />
                    <span>Show Panel</span>
                  </>
                ) : (
                  <>
                    <PanelRightClose size={15} />
                    <span className="text-[11px]">Hide Panel</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Dynamic Page Outlet */}
          <Outlet />
        </main>

        {/* Right Sidebar (Sticky Desktop & Collapsible) - hidden on /shows where checkout info takes place */}
        {!isShowPage && !rightCollapsed && (
          <div className="hidden xl:block sticky top-0 h-screen overflow-y-auto border-l border-slate-200/60 dark:border-slate-800/80 shrink-0 animate-fade-in">
            <SeatlyRightSidebar onCollapse={toggleRightSidebar} />
          </div>
        )}
      </div>
    </div>
  );
}
