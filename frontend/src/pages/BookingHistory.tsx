import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Ticket } from 'lucide-react';
import { customerApi } from '../api';
import { formatIST, formatINR } from '../utils/format';
import SparkleIcon from '../components/seatly/SparkleIcon';

export default function BookingHistory() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: customerApi.getOrders,
  });

  if (isLoading) return (
    <div className="w-full space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-full mb-6" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-3xl bg-slate-200/70 dark:bg-slate-800/70" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full animate-fade-in space-y-6">
      <div className="flex items-center gap-2">
        <SparkleIcon size={20} className="text-[#D4F63B]" />
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          My Bookings
        </h1>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <Ticket size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-400 font-semibold text-sm">No bookings yet.</p>
          <Link to="/events" className="text-slate-950 dark:text-[#D4F63B] font-bold text-xs mt-2 inline-block underline">
            Browse events →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: Record<string, unknown>) => {
            const bookings = (order.bookings as Record<string, unknown>[]) ?? [];
            const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;

            return (
              <Link
                key={order.id as string}
                to={`/orders/${order.id}`}
                id={`order-${order.id}`}
                className="block bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-extrabold text-slate-900 dark:text-white text-base group-hover:text-[#6A4FE2] dark:group-hover:text-[#D4F63B] transition-colors">
                        {order.event_title as string}
                      </h2>
                      <StatusBadge status={order.status as string} />
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 mt-2">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        {formatIST(order.starts_at as string)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-slate-400" />
                        {order.venue_name as string}, {order.city as string}
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                        <Ticket size={13} className="text-[#D4F63B]" />
                        {confirmedCount} seat{confirmedCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-slate-900 dark:text-white">{formatINR(Number(order.total_price))}</p>
                    <p className="text-xs text-slate-400 font-mono tracking-wider">{order.booking_ref as string}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-[#EAF8E5] text-[#2C8022]',
    partially_cancelled: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  };
  return (
    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider ${styles[status] ?? styles.confirmed}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
