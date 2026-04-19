import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setStatus('error'); setError('Missing verification token.'); return; }
    verifyEmail(token)
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate('/'), 2500);
      })
      .catch(err => {
        setStatus('error');
        setError(err.response?.data?.error || 'Invalid or expired verification link.');
      });
  }, []); // eslint-disable-line

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <p style={{ fontSize: 28, fontWeight: 800, color: '#185fa5', marginBottom: 24 }}>⚡ TollSync</p>

        {status === 'verifying' && (
          <>
            <span className="spinner spinner-lg" style={{ margin: '0 auto 16px', display: 'block' }} />
            <p style={{ color: '#555', fontSize: 15 }}>Verifying your email...</p>
          </>
        )}

        {status === 'success' && (
          <div className="card" style={{ padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>Email verified!</p>
            <p style={{ color: '#666', fontSize: 14 }}>Taking you to the app...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="card" style={{ padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>Verification failed</p>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>{error}</p>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => navigate('/login')}>
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
