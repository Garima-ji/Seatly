import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, Mail, ArrowRight, RefreshCw } from 'lucide-react';
import { authApi } from '../api';
import { useAuthStore } from '../store';
import SparkleIcon from '../components/seatly/SparkleIcon';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { user, updateUser } = useAuthStore();

  const [loading, setLoading] = useState(!!token);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [resendEmail, setResendEmail] = useState(user?.email || '');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    authApi
      .verifyEmail(token)
      .then(() => {
        if (isMounted) {
          setSuccess(true);
          if (user) {
            updateUser({ email_verified: true });
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          const msg = err?.response?.data?.error || 'Invalid or expired verification link.';
          setError(msg);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;

    setResendLoading(true);
    setResendMessage('');
    setError('');

    try {
      const res = await authApi.resendVerification(resendEmail);
      setResendMessage(res.message || 'Verification email sent! Please check your inbox.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to send verification email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-[#F7F7F5] dark:bg-[#0E1013]">
      <div className="w-full max-w-md">
        <div className="glass rounded-3xl p-8 border border-slate-200/60 dark:border-slate-800 shadow-xl text-center">
          {loading ? (
            <div className="py-8">
              <RefreshCw className="animate-spin text-amber-500 mx-auto mb-4" size={40} />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Verifying your email...</h2>
              <p className="text-sm text-slate-500 mt-2">Please wait while we confirm your account.</p>
            </div>
          ) : success ? (
            <div className="py-6 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5 text-emerald-500 shadow-lg shadow-emerald-500/10">
                <CheckCircle size={36} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Email Verified!</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 mb-6">
                Your Seatly account is now fully verified. You can now hold seats, book tickets, and manage events.
              </p>
              <button
                onClick={() => navigate(user ? '/events' : '/login')}
                className="btn btn-primary w-full py-3 text-base font-bold shadow-lg shadow-amber-500/20"
              >
                {user ? 'Browse Events' : 'Sign In to Seatly'}
                <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div className="py-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto mb-5 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-lg shadow-black/5">
                <Mail size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {error ? 'Verification Issue' : 'Verify Your Email'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 mb-6">
                {error || 'Enter your email address below to receive a single-use verification link.'}
              </p>

              {resendMessage && (
                <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-3">
                  <CheckCircle size={18} className="shrink-0 text-emerald-500" />
                  <span>{resendMessage}</span>
                </div>
              )}

              <form onSubmit={handleResend} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resendLoading}
                  className="btn btn-primary w-full py-3 text-base font-bold shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  {resendLoading ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail size={18} />
                      Resend Verification Link
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
