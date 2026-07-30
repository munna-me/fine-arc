import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Eye, EyeOff, LogIn, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];

const STRENGTH_CHECKS = [
  ['length', '8+ characters', (pw) => pw.length >= 8],
  ['upper', 'Uppercase letter', (pw) => /[A-Z]/.test(pw)],
  ['lower', 'Lowercase letter', (pw) => /[a-z]/.test(pw)],
  ['number', 'Number', (pw) => /[0-9]/.test(pw)],
  ['special', 'Special character', (pw) => /[^A-Za-z0-9]/.test(pw)],
];

function scorePassword(password) {
  const results = STRENGTH_CHECKS.map(([key, label, test]) => [key, label, test(password)]);
  const score = results.filter(([, , met]) => met).length;
  return { results, score };
}

export default function AuthPage({ theme = 'dark' }) {
  const { login, register, loginWithGoogle, continueAsGuest } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const googleButtonRef = useRef(null);

  const { results: strengthResults, score } = scorePassword(password);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;

    let cancelled = false;
    let interval;

    const handleCredential = async (response) => {
      setFormError(null);
      setSubmitting(true);
      try {
        await loginWithGoogle(response.credential);
      } catch (err) {
        setFormError(err.message);
      } finally {
        setSubmitting(false);
      }
    };

    const tryRender = () => {
      if (cancelled || !window.google || !googleButtonRef.current) return false;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      });
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        width: 336,
        text: mode === 'register' ? 'signup_with' : 'signin_with',
      });
      return true;
    };

    if (!tryRender()) {
      interval = setInterval(() => {
        if (tryRender()) clearInterval(interval);
      }, 300);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [theme, mode, loginWithGoogle]);

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setFormError(null);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);

    if (mode === 'register' && password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`app-shell theme-${theme} auth-shell`}>
      <div className="auth-backdrop" aria-hidden="true">
        <span className="auth-blob auth-blob--one" />
        <span className="auth-blob auth-blob--two" />
        <span className="auth-blob auth-blob--three" />
        <span className="auth-blob auth-blob--four" />
      </div>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="auth-brand">
          <img src="/finearc-logo.png" alt="Fine Arc" className="auth-logo" />
          <span>Numerical Methods Studio</span>
        </div>

        {GOOGLE_CLIENT_ID && (
          <>
            <div ref={googleButtonRef} className="auth-google-button" />
            <div className="auth-divider">
              <span>or continue with email</span>
            </div>
          </>
        )}

        <div className="auth-tabs" role="tablist" aria-label="Sign in or create an account">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => switchMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'active' : ''}
            onClick={() => switchMode('register')}
          >
            Create account
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={mode}
            onSubmit={handleSubmit}
            initial={{ opacity: 0, x: mode === 'login' ? -12 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === 'login' ? 12 : -12 }}
            transition={{ duration: 0.2 }}
            className="auth-form"
          >
            <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="auth-subtitle">
              {mode === 'login'
                ? 'Sign in to keep solving with Fine Arc.'
                : 'Set up an account to start solving with Fine Arc.'}
            </p>

            <label className="field-block auth-field">
              <span>Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label className="field-block auth-field">
              <span>Password</span>
              <div className="auth-password-row">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'}
                />
                <button
                  type="button"
                  className="auth-eye-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {mode === 'register' && password.length > 0 && (
              <div className="auth-strength">
                <div className="auth-strength-track">
                  <motion.div
                    className={`auth-strength-fill strength-${score}`}
                    initial={false}
                    animate={{ width: `${(score / 5) * 100}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
                <span className="auth-strength-label">{STRENGTH_LABELS[Math.max(score - 1, 0)]}</span>
                <ul className="auth-strength-checks">
                  {strengthResults.map(([key, label, met]) => (
                    <li key={key} className={met ? 'met' : ''}>
                      {met ? <Check size={13} /> : <X size={13} />}
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mode === 'register' && (
              <label className="field-block auth-field">
                <span>Confirm password</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
                />
              </label>
            )}

            {formError && <div className="inline-error">{formError}</div>}

            <motion.button
              type="submit"
              className="btn-primary full-width auth-submit"
              disabled={submitting}
              whileHover={{ scale: submitting ? 1 : 1.02 }}
              whileTap={{ scale: submitting ? 1 : 0.98 }}
            >
              {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
              {submitting
                ? mode === 'login'
                  ? 'Signing in…'
                  : 'Creating account…'
                : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
            </motion.button>
          </motion.form>
        </AnimatePresence>

        <p className="auth-switch">
          {mode === 'login' ? (
            <>
            New to Fine Arc?{' '}
            <button type="button" onClick={() => switchMode('register')}>
              Create an account
            </button>
            </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button type="button" onClick={() => switchMode('login')}>
                    Sign in
                  </button>
                </>
              )}
            </p>

            <button
              type="button"
              className="auth-guest-link"
              onClick={continueAsGuest}
            >
              Continue as guest
            </button>

            </motion.div>
            </div>
  );
}