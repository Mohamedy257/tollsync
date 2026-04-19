import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const WA_NUMBER = '6673598525';

function waLink(message = '') {
  const base = `https://wa.me/${WA_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

const QUICK_TOPICS = [
  { label: 'Upload issue', message: 'Hi! I need help with a file upload issue in TollSync.' },
  { label: 'Billing question', message: 'Hi! I have a question about my TollSync billing.' },
  { label: 'Toll matching problem', message: 'Hi! My tolls are not matching correctly in TollSync.' },
  { label: 'General question', message: 'Hi! I have a question about TollSync.' },
];

export default function ContactPage() {
  const { host } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header">
        <h2>Chat with us</h2>
        <p>We're available on WhatsApp — tap below to start a conversation.</p>
      </div>

      {/* Main WhatsApp CTA */}
      <div className="card" style={{ textAlign: 'center', padding: '32px 24px', marginBottom: 20 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
          background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 6px' }}>WhatsApp Support</p>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 6px' }}>+{WA_NUMBER}</p>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 24px' }}>
          Typically replies within a few hours during business hours
        </p>
        <a
          href={waLink(`Hi! I'm a TollSync user${host?.email ? ` (${host.email})` : ''} and need some help.`)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: '#25D366', color: '#fff', fontWeight: 700,
            fontSize: 15, padding: '13px 28px', borderRadius: 12,
            textDecoration: 'none',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Open WhatsApp
        </a>
      </div>

      {/* Quick topic shortcuts */}
      <p className="section-title">Quick topics</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 24 }}>
        {QUICK_TOPICS.map(topic => (
          <a
            key={topic.label}
            href={waLink(topic.message)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              background: '#fff', border: '1px solid #e5e3de', borderRadius: 10,
              textDecoration: 'none', color: '#1a1a1a', fontSize: 13, fontWeight: 500,
            }}
          >
            <span style={{ color: '#25D366', fontSize: 16 }}>💬</span>
            {topic.label}
          </a>
        ))}
      </div>

      {/* Browse FAQ */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
        <span style={{ fontSize: 24 }}>📖</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 2px' }}>Browse the FAQ first</p>
          <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Most common questions are already answered.</p>
        </div>
        <button className="btn btn-sm" onClick={() => navigate('/support')}>View FAQ</button>
      </div>
    </div>
  );
}
