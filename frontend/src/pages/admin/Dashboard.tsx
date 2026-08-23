import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Calendar } from 'lucide-react';
import { adminApi } from '../../api';

export default function AdminDashboard() {
  const { data: venues = [] } = useQuery({ queryKey: ['admin-venues'], queryFn: adminApi.getVenues });

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Admin Dashboard</h1>
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={<Building2 className="text-amber-500" />} label="Venues" value={venues.length} />
        <StatCard icon={<Calendar className="text-amber-500" />} label="Active Shows" value="—" />
        <StatCard icon={<Users className="text-orange-500" />} label="Total Users" value="—" />
      </div>
      <div className="mt-8">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Quick Links</h2>
        <div className="grid gap-2">
          <a href="/admin/venues" className="glass rounded-xl p-4 border border-amber-500/15 hover:border-amber-400/40 transition-colors flex items-center gap-3 card-hover">
            <Building2 size={20} className="text-amber-500" />
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Manage Venues & Seats</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="glass rounded-2xl p-5 border border-amber-500/15">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-amber-50/70 dark:bg-slate-800 flex items-center justify-center">{icon}</div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-3xl font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
