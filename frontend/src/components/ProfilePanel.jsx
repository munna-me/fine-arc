import React, { useEffect, useState } from 'react';
import { Calculator, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../api/client';

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 10px',
  color: 'var(--text)',
  fontSize: '0.85rem',
};

// Positioned by the parent (a `position: relative` wrapper around the
// Profile button) — this panel itself just anchors to that with absolute
// positioning, top: 100% + right: 0, so it always drops directly under
// the button rather than centering on the page.
export default function ProfilePanel({ onLogout }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/auth/me');
        if (!res.ok) throw new Error('Could not load your profile.');
        const data = await res.json();
        if (!cancelled) setProfile(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        zIndex: 91,
        width: '260px',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: '12px',
        boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
        padding: '10px',
      }}
    >
      {error && <div style={{ ...rowStyle, color: 'var(--danger)' }}>{error}</div>}
      {!profile && !error && <div style={rowStyle}>Loading…</div>}

      {profile && (
        <>
          <div style={rowStyle}>
            <Mail size={14} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.email}
            </span>
          </div>
          <div style={rowStyle}>
            <ShieldCheck size={14} />
            <span>{profile.auth_provider === 'google' ? 'Signed in with Google' : 'Email & password'}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--muted)' }}>Member since</span>
            <span style={{ marginLeft: 'auto' }}>
              {new Date(profile.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: '8px 4px',
              padding: '10px',
              borderRadius: '10px',
              background: 'var(--primary-soft)',
              color: 'var(--primary-strong)',
            }}
          >
            <Calculator size={18} />
            <div>
              <strong style={{ display: 'block', fontSize: '1.15rem', lineHeight: 1.1 }}>
                {profile.solve_count}
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {profile.solve_count === 1 ? 'problem solved' : 'problems solved'}
              </span>
            </div>
          </div>
        </>
      )}

      <div style={{ borderTop: '1px solid var(--line)', marginTop: '4px', paddingTop: '4px' }}>
        <button
          type="button"
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            border: 0,
            background: 'transparent',
            color: 'var(--text)',
            padding: '9px 10px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <LogOut size={14} />
          Log out
        </button>
      </div>
    </div>
  );
}