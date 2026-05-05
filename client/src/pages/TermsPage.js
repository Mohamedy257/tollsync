import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_TERMS = `1. Acceptance
By creating an account, you agree to these Terms. If you do not agree, do not use TollSync.

2. Service
TollSync helps rental car hosts calculate and track toll charges. We are not affiliated with any toll authority or rental platform.

3. Subscription & Billing
Access requires an active paid subscription. Subscriptions renew monthly. You may cancel at any time through the billing portal. No refunds are provided for partial billing periods.

4. Data & Accuracy
You are responsible for the accuracy of data you upload. TollSync uses AI to parse documents and may make errors. Always verify results before billing customers. TollSync is not liable for any errors in toll calculations or decisions made based on the service output.

5. Privacy
We store your account data and uploaded files to provide the service. We do not sell your data to third parties.

6. Changes
We may update these Terms at any time. Continued use of the service constitutes acceptance of the updated Terms.`;

export default function TermsPage() {
  const navigate = useNavigate();
  const [text, setText] = useState('');

  useEffect(() => {
    fetch('/api/billing/plan').then(r => r.json()).then(d => {
      if (d.terms_text) setText(d.terms_text);
    }).catch(() => {});
  }, []);

  const content = text || DEFAULT_TERMS;

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
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Terms & Conditions</h1>
          <p style={{ fontSize: 13, color: '#888' }}>Last updated: May 2025</p>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e5e3de', borderRadius: 16, padding: '28px 32px' }}>
          <div style={{ fontSize: 14, color: '#444', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {content}
          </div>
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
