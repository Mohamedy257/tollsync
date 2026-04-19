import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function AccountPage() {
  const { host, refreshHost } = useAuth();

  const [profile, setProfile] = useState({ name: host?.name || '', email: host?.email || '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');

  const isOAuth = !!host?.oauth_provider;

  const saveProfile = async e => {
    e.preventDefault();
    setProfileSaving(true); setProfileError(''); setProfileSuccess('');
    try {
      await api.put('/auth/account', { name: profile.name, email: profile.email });
      await refreshHost();
      setProfileSuccess('Profile updated.');
    } catch (err) {
      setProfileError(err.response?.data?.error || 'Failed to save');
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async e => {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) { setPwError('Passwords do not match'); return; }
    setPwSaving(true); setPwError(''); setPwSuccess('');
    try {
      await api.put('/auth/account', {
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      setPw({ current_password: '', new_password: '', confirm: '' });
      setPwSuccess('Password updated.');
    } catch (err) {
      setPwError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Account Settings</h2>
        <p>Manage your profile and password.</p>
      </div>

      {/* Profile */}
      <div className="card" style={{ marginBottom: 16, padding: 20 }}>
        <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Profile</p>
        {isOAuth && (
          <div className="alert" style={{ background: '#f0ede8', color: '#555', fontSize: 13, marginBottom: 16, borderRadius: 8, padding: '10px 14px' }}>
            Signed in via <strong style={{ textTransform: 'capitalize' }}>{host.oauth_provider}</strong>. Email cannot be changed.
          </div>
        )}
        <form onSubmit={saveProfile}>
          <div className="form-group">
            <label>Name</label>
            <input
              className="form-control"
              value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              placeholder="Your name"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              className="form-control"
              type="email"
              value={profile.email}
              onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
              disabled={isOAuth}
              style={isOAuth ? { background: '#f5f5f5', color: '#aaa' } : {}}
            />
          </div>
          {profileError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{profileError}</div>}
          {profileSuccess && <div className="alert" style={{ background: '#eaf3de', color: '#3b6d11', marginBottom: 10, borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>{profileSuccess}</div>}
          <button className="btn btn-primary" type="submit" disabled={profileSaving}>
            {profileSaving ? <><span className="spinner" /> Saving...</> : 'Save profile'}
          </button>
        </form>
      </div>

      {/* Password */}
      {!isOAuth && (
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Change password</p>
          <form onSubmit={savePassword}>
            <div className="form-group">
              <label>Current password</label>
              <input
                className="form-control"
                type="password"
                placeholder="••••••••"
                value={pw.current_password}
                onChange={e => setPw(p => ({ ...p, current_password: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>New password</label>
              <input
                className="form-control"
                type="password"
                placeholder="••••••••"
                value={pw.new_password}
                onChange={e => setPw(p => ({ ...p, new_password: e.target.value }))}
                required
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label>Confirm new password</label>
              <input
                className="form-control"
                type="password"
                placeholder="••••••••"
                value={pw.confirm}
                onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                required
                minLength={6}
              />
            </div>
            {pwError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{pwError}</div>}
            {pwSuccess && <div className="alert" style={{ background: '#eaf3de', color: '#3b6d11', marginBottom: 10, borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>{pwSuccess}</div>}
            <button className="btn btn-primary" type="submit" disabled={pwSaving}>
              {pwSaving ? <><span className="spinner" /> Saving...</> : 'Update password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
