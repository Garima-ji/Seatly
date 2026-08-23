import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore, useThemeStore } from '../store';
import { authApi } from '../api';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import SparkleIcon from '../components/seatly/SparkleIcon';

export default function Login() {
  const { setAuth } = useAuthStore();
  const { isDark } = useThemeStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const doLogin = async (emailToUse: string, passwordToUse: string) => {
    setError('');
    setLoading(true);
    try {
      const { user, accessToken, refreshToken } = await authApi.login(emailToUse, passwordToUse);
      setAuth(user, accessToken, refreshToken);
      // Redirect based on role
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'organiser') navigate('/organiser');
      else navigate('/events');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Login failed. Please make sure database is seeded with demo accounts.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(form.email, form.password);
  };

  const handleGuestQuickLogin = (email: string, pass: string) => {
    setForm({ email, password: pass });
    doLogin(email, pass);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 bg-[#F7F7F5] dark:bg-[#0E1013]">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="glass rounded-2xl shadow-xl p-8 animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-slate-800 flex items-center justify-center shadow-lg shadow-black/10">
              <SparkleIcon size={24} className="text-[#D4F63B]" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-1">
            Sign in to Seatly
          </h1>
          <p className="text-xs text-center text-slate-500 dark:text-slate-400 mb-6">
            Welcome back! Please sign in to your account.
          </p>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm mb-4">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn btn-md w-full mt-2 font-bold bg-black text-white hover:bg-slate-900 border border-slate-800/80 active:scale-95 transition-all shadow-lg shadow-black/30"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
            Don't have an account?{' '}
            <Link to="/register" className="text-emerald-600 dark:text-[#D4F63B] font-bold hover:underline">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

