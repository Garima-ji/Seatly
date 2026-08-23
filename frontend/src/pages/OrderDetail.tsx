import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QrCode, MapPin, Calendar, XCircle, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { customerApi } from '../api';
import { formatIST, formatINR } from '../utils/format';
import SparkleIcon from '../components/seatly/SparkleIcon';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => customerApi.getOrder(id!),
    enabled: !!id,
  });

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Cancel this seat booking?')) return;
    setCancellingId(bookingId);
    setError('');
    try {
      await customerApi.cancelBooking(bookingId);
      setSuccess('Seat cancelled successfully.');
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to cancel booking.');
    } finally {
      setCancellingId(null);
    }
  };

  if (isLoading) return (
    <div className="w-full space-y-4 animate-pulse">
      <div className="h-64 rounded-3xl bg-slate-200/70 dark:bg-slate-800/70" />
    </div>
  );

  if (!order) return (
    <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
      <p className="text-slate-500 font-semibold">Order not found.</p>
    </div>
  );

  const bookings = order.bookings ?? [];
  const confirmedBookings = bookings.filter((b: Record<string, unknown>) => b.status === 'confirmed');

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/bookings')}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Order Details</h1>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          <CheckCircle size={14} />
          {success}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
        {/* Event info */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1.5">{order.event_title}</h2>
            <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-[#D4F63B]" />
                {formatIST(order.starts_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="text-[#D4F63B]" />
                {order.venue_name}, {order.city}
              </span>
            </div>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Booking Ref</p>
            <p className="text-base font-extrabold text-slate-900 dark:text-white font-mono tracking-widest">{order.booking_ref}</p>
          </div>
        </div>

        {/* Seats */}
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Booked Seats</h3>
          <div className="space-y-2">
            {bookings.map((b: Record<string, unknown>) => (
              <div key={b.booking_id as string} className={`flex items-center justify-between py-2.5 px-4 rounded-2xl ${
                b.status === 'cancelled'
                  ? 'bg-red-50 dark:bg-red-950/20 opacity-60'
                  : 'bg-slate-50 dark:bg-slate-800/60'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Row {b.row_label as string}, Seat {b.seat_number as number}
                  </span>
                  <span className="text-[11px] text-slate-400">({b.category_name as string})</span>
                  {b.status === 'cancelled' && (
                    <span className="text-[10px] text-red-500 font-bold uppercase">(Cancelled)</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">{formatINR(Number(b.price))}</span>
                  {b.status === 'confirmed' && (
                    <button
                      id={`cancel-booking-${b.booking_id}`}
                      onClick={() => handleCancel(b.booking_id as string)}
                      disabled={cancellingId === b.booking_id}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors p-1"
                      title="Cancel this seat"
                    >
                      <XCircle size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Total Paid</span>
          <span className="text-lg font-black text-slate-900 dark:text-white">{formatINR(Number(order.total_price))}</span>
        </div>
      </div>

      {/* QR Code */}
      {order.qr_data && confirmedBookings.length > 0 && (
        <div className="bg-[#121316] text-white rounded-3xl p-6 text-center shadow-xl border border-slate-800">
          <div className="flex items-center justify-center gap-2 mb-3">
            <SparkleIcon size={16} className="text-[#D4F63B]" />
            <h3 className="text-sm font-bold">Show this ticket QR at the venue</h3>
          </div>
          <div className="p-4 bg-white rounded-2xl inline-block shadow-md">
            <img
              src={order.qr_data}
              alt={`QR code for booking ${order.booking_ref}`}
              className="w-44 h-44 mx-auto"
            />
          </div>
          <p className="text-xs text-slate-400 mt-3 font-mono tracking-widest">{order.booking_ref}</p>
        </div>
      )}
    </div>
  );
}
