import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { authApi } from '../api';

interface GoogleSignInButtonProps {
  role?: string;
  onError?: (err: string) => void;
  text?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: string;
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
              logo_alignment?: string;
              width?: number;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function GoogleSignInButton({
  role = 'customer',
  onError,
  text = 'Continue with Google',
}: GoogleSignInButtonProps) {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  const handleCredentialResponse = async (credential: string) => {
    setLoading(true);
    try {
      const { user, accessToken, refreshToken } = await authApi.googleAuth({
        credential,
        role,
      });
      setAuth(user, accessToken, refreshToken);
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'organiser') navigate('/organiser');
      else navigate('/events');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      onError?.(msg ?? 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!googleClientId) return;

    // Load Google Identity Services script if not loaded
    if (!document.getElementById('google-client-script')) {
      const script = document.createElement('script');
      script.id = 'google-client-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initGoogle();
      };
      document.body.appendChild(script);
    } else if (window.google) {
      initGoogle();
    }

    function initGoogle() {
      if (!window.google || !googleClientId) return;
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (res) => handleCredentialResponse(res.credential),
        });
      } catch (e) {
        console.error('Google init error:', e);
      }
    }
  }, [googleClientId]);

  const handleManualClick = () => {
    if (googleClientId && window.google) {
      window.google.accounts.id.prompt();
    } else {
      // In development or when no Client ID is configured, guide user
      onError?.(
        'Google Client ID is not configured. Please set VITE_GOOGLE_CLIENT_ID in your environment variables, or sign in with email/password.'
      );
    }
  };

  return (
    <div className="w-full">
      <div ref={googleBtnRef} className="hidden" />
      <button
        type="button"
        onClick={handleManualClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-all shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-60"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
        <span>{loading ? 'Connecting to Google…' : text}</span>
      </button>
    </div>
  );
}
