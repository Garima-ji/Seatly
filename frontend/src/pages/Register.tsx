import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { authApi } from '../api';
import { Eye, EyeOff, AlertCircle, Mail } from 'lucide-react';
import SparkleIcon from '../components/seatly/SparkleIcon';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function Register() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '', role: 'customer',
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationPending, setVerificationPending] = useState<{ email: string; name: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.register(form);
      setAuth(res.user, res.accessToken, res.refreshToken);
      setVerificationPending({ email: form.email, name: form.full_name });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (verificationPending) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-16 bg-[#F7F7F5] dark:bg-[#0E1013]">
        <div className="w-full max-w-md">
          <div className="glass rounded-2xl shadow-xl p-8 animate-fade-in text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto mb-5 text-slate-800 dark:text-slate-200 shadow-lg shadow-black/5 border border-slate-200 dark:border-slate-800">
              <Mail size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Check your email</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 mb-4">
              We've sent a verification link to <strong className="text-slate-900 dark:text-white">{verificationPending.email}</strong>.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Please click the link in your email to verify your ownership and unlock seat bookings and event management.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate('/events')}
                className="btn btn-primary w-full py-2.5 font-bold shadow-lg shadow-amber-500/20"
              >
                Browse Events
              </button>
              <Link
                to="/verify-email"
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
              >
                Didn't receive the email? Request another link
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-16 bg-[#F7F7F5] dark:bg-[#0E1013]">
      <div className="w-full max-w-md">
        <div className="glass rounded-2xl shadow-xl p-8 animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-slate-800 flex items-center justify-center shadow-lg shadow-black/10">
              <SparkleIcon size={24} className="text-[#D4F63B]" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-1">Create account</h1>
          <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6">Join Seatly and start booking</p>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm mb-4">
              <AlertCircle size={14} />
              {error}
            </div>
          )}



          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input id="full_name" type="text" required className="input" placeholder="Priya Sharma"
                value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input id="reg-email" type="email" autoComplete="email" required className="input" placeholder="you@example.com"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
              <input id="phone" type="tel" required className="input" placeholder="+91 9876543210"
                value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <div className="relative">
                <input id="reg-password" type={showPw ? 'text' : 'password'} autoComplete="new-password" required
                  className="input pr-10" placeholder="Min 8 characters"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Account Type</label>
              <select id="role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="customer">Customer</option>
                <option value="organiser">Event Organiser</option>
              </select>
            </div>

            <button id="register-submit" type="submit" disabled={loading} className="btn btn-md w-full mt-2 font-bold bg-black text-white hover:bg-slate-900 border border-slate-800/80 active:scale-95 transition-all shadow-lg shadow-black/30">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-600 dark:text-[#D4F63B] font-bold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
