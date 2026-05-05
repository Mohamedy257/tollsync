import React from 'react';
import { useNavigate } from 'react-router-dom';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: `When you create an account, we collect your name, email address, and optionally your phone number. When you upload documents, we temporarily process the file contents to extract trip and toll data using AI. We also collect basic usage data (page visits, feature usage) to improve the service.`,
  },
  {
    title: '2. How We Use Your Information',
    body: `We use your information solely to provide and improve TollSync. Specifically:
• Your account data (name, email) is used for authentication and support.
• Uploaded files are processed by AI to extract trip and toll records and are associated with your account.
• We do not use your data to train AI models shared with other users.
• We do not sell, rent, or share your personal data with third parties for marketing purposes.`,
  },
  {
    title: '3. Data Storage & Security',
    body: `Your data is stored on secure servers. We use industry-standard encryption in transit (HTTPS/TLS) and at rest. Access to stored data is restricted to authorized systems and personnel only.`,
  },
  {
    title: '4. Third-Party Services',
    body: `We use the following third-party services to operate TollSync:
• Stripe — for payment processing. Stripe's privacy policy governs payment data.
• Anthropic / Claude — for AI-powered document parsing. Files are sent to Anthropic's API for processing and are subject to Anthropic's data usage policies.
• Resend — for transactional email delivery.

We do not control the privacy practices of these third parties and encourage you to review their policies.`,
  },
  {
    title: '5. Data Retention',
    body: `We retain your account data and uploaded records for as long as your account is active. If you delete your account, your data is permanently removed from our systems within 30 days.`,
  },
  {
    title: '6. Your Rights',
    body: `You have the right to access, correct, or delete the personal data we hold about you. To request this, contact us at the address below. We will respond within 30 days.`,
  },
  {
    title: '7. Cookies',
    body: `TollSync uses a single session cookie to keep you logged in. We do not use tracking cookies or third-party advertising cookies.`,
  },
  {
    title: '8. Children\'s Privacy',
    body: `TollSync is not intended for use by anyone under the age of 18. We do not knowingly collect personal data from children.`,
  },
  {
    title: '9. Changes to This Policy',
    body: `We may update this Privacy Policy from time to time. We will notify you of material changes by email or by a notice in the app. Continued use of TollSync after changes take effect constitutes acceptance of the updated policy.`,
  },
  {
    title: '10. Contact',
    body: `If you have any questions about this Privacy Policy or how we handle your data, please contact us through the Contact page or by emailing us directly.`,
  },
];

export default function PrivacyPage() {
  const navigate = useNavigate();

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

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
          <p style={{ fontSize: 13, color: '#888' }}>Last updated: May 2025</p>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e5e3de', borderRadius: 16, padding: '28px 32px' }}>
          <p style={{ fontSize: 15, color: '#555', lineHeight: 1.7, marginBottom: 28 }}>
            TollSync ("we", "us", "our") is committed to protecting your privacy. This policy explains what information we collect, how we use it, and your rights regarding your data.
          </p>

          {SECTIONS.map((s, i) => (
            <div key={i} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: i < SECTIONS.length - 1 ? '0.5px solid #f0ede8' : 'none' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{s.title}</h2>
              <p style={{ fontSize: 14, color: '#555', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <button onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#185fa5', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
            ← Back to home
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: '#111', color: 'rgba(255,255,255,0.5)', padding: '28px 24px', textAlign: 'center', fontSize: 13 }}>
        <p>© {new Date().getFullYear()} TollSync · <button onClick={() => navigate('/terms')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}>Terms</button> · <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}>Privacy</button></p>
      </footer>
    </div>
  );
}
