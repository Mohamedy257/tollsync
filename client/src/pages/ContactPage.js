import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function waLink(number, message = '') {
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

const WA_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function ContactPage() {
  const { host } = useAuth();
  const navigate = useNavigate();
  const [contact, setContact] = useState({ whatsapp_number: null, support_email: null });

  useEffect(() => {
    fetch('/api/billing/contact').then(r => r.json()).then(d => setContact(d)).catch(() => {});
    if (!host) document.title = 'Contact Us — TollSync';
  }, [host]);

  const waNumber = contact.whatsapp_number;
  const supportEmail = contact.support_email;
  const isPublic = !host;

  const content = (
    <div style={isPublic ? { maxWidth: 560, margin: '0 auto', padding: '48px 24px 80px' } : {}}>
      {isPublic && (
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Contact us</h1>
          <p style={{ fontSize: 15, color: '#666' }}>We're here to help — reach out any time.</p>
        </div>
      )}

      {!isPublic && (
        <div className="page-header">
          <h2>Contact us</h2>
          <p>We're available on WhatsApp and email — reach out any time.</p>
        </div>
      )}

      {/* WhatsApp */}
      {waNumber ? (
        <div className={isPublic ? '' : 'card'} style={{
          ...(isPublic ? {
            background: '#fff', border: '0.5px solid #e5e3de', borderRadius: 16,
            padding: '28px 24px', marginBottom: 16, textAlign: 'center',
          } : { textAlign: 'center', padding: '32px 24px', marginBottom: 16 }),
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 14px',
            background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <p style={{ fontWeight: 700, fontSize: 17, margin: '0 0 4px' }}>WhatsApp</p>
          <p style={{ fontSize: 14, color: '#555', margin: '0 0 4px', fontWeight: 500 }}>+{waNumber}</p>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>Typically replies within a few hours</p>
          <a
            href={waLink(waNumber, `Hi! I have a question about TollSync${host?.email ? ` (${host.email})` : ''}.`)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: '#25D366', color: '#fff', fontWeight: 700,
              fontSize: 15, padding: '12px 28px', borderRadius: 12,
              textDecoration: 'none',
            }}
          >
            {WA_ICON} Open WhatsApp
          </a>
        </div>
      ) : null}

      {/* Email */}
      {supportEmail ? (
        <div className={isPublic ? '' : 'card'} style={{
          ...(isPublic ? {
            background: '#fff', border: '0.5px solid #e5e3de', borderRadius: 16,
            padding: '28px 24px', marginBottom: 16, textAlign: 'center',
          } : { textAlign: 'center', padding: '28px 24px', marginBottom: 16 }),
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 14px',
            background: '#185fa5', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
          </div>
          <p style={{ fontWeight: 700, fontSize: 17, margin: '0 0 4px' }}>Email</p>
          <p style={{ fontSize: 14, color: '#555', margin: '0 0 4px', fontWeight: 500 }}>{supportEmail}</p>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>We respond within 1 business day</p>
          <a
            href={`mailto:${supportEmail}?subject=${encodeURIComponent('TollSync Support')}&body=${encodeURIComponent(`Hi,\n\nI have a question about TollSync${host?.email ? ` (${host.email})` : ''}:\n\n`)}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#185fa5', color: '#fff', fontWeight: 700,
              fontSize: 15, padding: '12px 28px', borderRadius: 12,
              textDecoration: 'none',
            }}
          >
            Send email
          </a>
        </div>
      ) : null}

      {/* Fallback if nothing configured yet */}
      {!waNumber && !supportEmail && (
        <div style={{
          background: '#fff', border: '0.5px solid #e5e3de', borderRadius: 16,
          padding: '40px 24px', textAlign: 'center', color: '#888', fontSize: 14,
        }}>
          Contact details coming soon.
        </div>
      )}

      {/* Phone number shown as plain text alongside WhatsApp if set */}
      {waNumber && (
        <div style={{
          background: isPublic ? '#f8f7f4' : '#f8f7f4',
          border: '0.5px solid #e5e3de', borderRadius: 12,
          padding: '14px 18px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>📞</span>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>Phone / WhatsApp</p>
            <p style={{ fontSize: 13, color: '#666', margin: '2px 0 0' }}>+{waNumber}</p>
          </div>
          <a
            href={`tel:+${waNumber}`}
            style={{
              marginLeft: 'auto', background: '#1a1a1a', color: '#fff',
              borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600,
              textDecoration: 'none', flexShrink: 0,
            }}
          >
            Call
          </a>
        </div>
      )}

      {isPublic && (
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <button onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#185fa5', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
            ← Back to home
          </button>
        </div>
      )}
    </div>
  );

  if (isPublic) {
    return (
      <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f8f7f4', minHeight: '100vh' }}>
        {/* Nav */}
        <nav style={{
          background: '#fff', borderBottom: '0.5px solid #e5e3de',
          padding: '0 24px', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={() => navigate('/')}
            style={{ fontWeight: 700, fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span>⚡</span> TollSync
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/login')}
              style={{ background: 'none', border: '0.5px solid #d0cdc8', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
              Sign in
            </button>
            <button onClick={() => navigate('/login')}
              style={{ background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>
              Get started
            </button>
          </div>
        </nav>
        {content}
        <footer style={{ background: '#111', color: 'rgba(255,255,255,0.5)', padding: '28px 24px', textAlign: 'center', fontSize: 13 }}>
          <p>© {new Date().getFullYear()} TollSync · <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}>Privacy</button> · <button onClick={() => navigate('/terms')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}>Terms</button></p>
        </footer>
      </div>
    );
  }

  return content;
}
