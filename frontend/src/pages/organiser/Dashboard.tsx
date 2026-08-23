import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, TrendingUp, Ticket, BarChart2 } from 'lucide-react';
import { organiserApi } from '../../api';
import { formatINR } from '../../utils/format';

export default function OrganiserDashboard() {
  const { data: events = [] } = useQuery({ queryKey: ['organiser-events'], queryFn: organiserApi.getEvents });

  const totalEvents = (events as Record<string, unknown>[]).length;
  const totalShows = (events as Record<string, unknown>[]).reduce((sum, e) => sum + Number(e.show_count ?? 0), 0);

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Organiser Dashboard</h1>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="glass rounded-2xl p-5 border border-amber-500/15">
          <div className="flex items-center gap-2 mb-1">
            <Ticket size={16} className="text-amber-500" />
            <span className="text-xs font-semibold text-slate-500">My Events</span>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{totalEvents}</p>
        </div>
        <div className="glass rounded-2xl p-5 border border-amber-500/15">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={16} className="text-amber-500" />
            <span className="text-xs font-semibold text-slate-500">Total Shows</span>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{totalShows}</p>
        </div>
      </div>

      <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">Recent Events</h2>
      <div className="space-y-2">
        {(events as Record<string, unknown>[]).slice(0, 5).map((e) => (
          <Link key={e.id as string} to={`/organiser/events/${e.id}`}
            className="glass rounded-xl p-4 border border-amber-500/15 flex items-center justify-between card-hover block">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{e.title as string}</p>
              <p className="text-xs text-slate-500">{e.venue_name as string} · {e.city as string}</p>
            </div>
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{e.show_count as number} show{Number(e.show_count) !== 1 ? 's' : ''}</span>
          </Link>
        ))}
        {totalEvents === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm mb-2">No events yet.</p>
            <Link to="/organiser/events" className="btn btn-primary btn-sm">Create Event</Link>
          </div>
        )}
      </div>
    </div>
  );
}
