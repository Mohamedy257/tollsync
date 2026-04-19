import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#faf9f7', padding: 24, textAlign: 'center',
    }}>
      <p style={{ fontSize: 64, margin: 0 }}>🛣️</p>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: '16px 0 8px' }}>Page not found</h2>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
        The page you're looking for doesn't exist.
      </p>
      <button className="btn btn-primary" onClick={() => navigate('/')}>
        Go to dashboard
      </button>
    </div>
  );
}
