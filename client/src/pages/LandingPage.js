import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const pricingRef = useRef();

  useEffect(() => {
    fetch('/api/billing/plan').then(r => r.json()).then(d => setPlan(d)).catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const price = plan?.price_cents ? (plan.price_cents / 100).toFixed(0) : null;
  const trialDays = plan?.free_trial_days || 7;

  const scrollToPricing = () => {
    pricingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const FEATURES = [
    { icon: '📸', title: 'Any format', desc: 'Upload trip screenshots, PDFs, or CSVs — AI reads them all.' },
    { icon: '⚡', title: 'Auto-matched', desc: 'Toll charges are automatically matched to each renter by date and transponder.' },
    { icon: '🚗', title: 'Multi-vehicle', desc: 'Manage an entire fleet. Each car gets its own transponder and history.' },
    { icon: '📄', title: 'Dispute-ready exports', desc: 'Save per-renter toll receipts as images to attach directly to rental platform claims.' },
    { icon: '🛣️', title: 'EZ-Pass & more', desc: 'Supports EZ-Pass, E-ZPass, SunPass, and most major toll statement formats.' },
    { icon: '🔒', title: 'Private & secure', desc: 'Your data is stored securely and never shared with third parties.' },
  ];

  const STEPS = [
    { n: 1, icon: '📋', title: 'Upload your trip list', desc: 'Take a screenshot of your trips page or export a CSV. We parse it automatically.' },
    { n: 2, icon: '🛣️', title: 'Upload your toll statement', desc: 'Drop in your EZ-Pass PDF, CSV, or a screenshot of your account activity.' },
    { n: 3, icon: '⚡', title: 'Results in seconds', desc: 'TollSync matches every toll charge to the right trip and renter automatically.' },
  ];

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', color: '#1a1a1a', overflowX: 'hidden' }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
        background: navScrolled ? 'rgba(255,255,255,0.96)' : 'transparent',
        backdropFilter: navScrolled ? 'blur(12px)' : 'none',
        borderBottom: navScrolled ? '0.5px solid #e5e3de' : 'none',
        transition: 'background 0.2s, border 0.2s',
        padding: '0 24px',
        height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ color: navScrolled ? '#1a1a1a' : '#fff' }}>TollSync</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none', border: navScrolled ? '0.5px solid #d0cdc8' : '1px solid rgba(255,255,255,0.5)',
              color: navScrolled ? '#1a1a1a' : '#fff', borderRadius: 8, padding: '7px 16px',
              fontSize: 14, cursor: 'pointer', fontWeight: 500,
            }}
          >
            Sign in
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: navScrolled ? '#1a1a1a' : '#fff',
              color: navScrolled ? '#fff' : '#185fa5',
              border: 'none', borderRadius: 8, padding: '7px 16px',
              fontSize: 14, cursor: 'pointer', fontWeight: 700,
            }}
          >
            Get started
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        background: 'linear-gradient(150deg, #0d2f5e 0%, #185fa5 55%, #1577d4 100%)',
        padding: '120px 24px 80px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative circles */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 99, padding: '5px 14px',
            fontSize: 13, color: 'rgba(255,255,255,0.9)', marginBottom: 28, fontWeight: 500,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
            {trialDays}-day free trial · no credit card required
          </div>

          <h1 style={{ fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.02em' }}>
            Stop leaving toll charges<br />on the table
          </h1>
          <p style={{ fontSize: 'clamp(15px, 2.5vw, 19px)', color: 'rgba(255,255,255,0.75)', maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.6 }}>
            TollSync automatically matches your EZ-Pass toll charges to each rental trip — so you can bill every renter accurately in seconds.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: '#fff', color: '#185fa5', border: 'none', borderRadius: 10,
                padding: '14px 32px', fontSize: 16, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              }}
            >
              Start free trial →
            </button>
            <button
              onClick={scrollToPricing}
              style={{
                background: 'rgba(255,255,255,0.12)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10,
                padding: '14px 28px', fontSize: 16, fontWeight: 600, cursor: 'pointer',
              }}
            >
              See pricing
            </button>
          </div>

          {/* Social proof chips */}
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', marginTop: 44 }}>
            {['📸 Screenshots', '📄 PDF & CSV', '🚗 Multi-vehicle', '⚡ Auto-matched'].map(label => (
              <span key={label} style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{label}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '80px 24px', background: '#f8f7f4' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#185fa5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>How it works</p>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, marginBottom: 48, letterSpacing: '-0.01em' }}>
            Three steps to zero missed tolls
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ background: '#fff', border: '0.5px solid #e5e3de', borderRadius: 16, padding: '28px 24px', position: 'relative' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#185fa5', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 16, marginBottom: 16,
                }}>
                  {s.n}
                </div>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <div style={{
                    display: 'none',
                    position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 20, color: '#ccc',
                  }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#185fa5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Features</p>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, marginBottom: 48, letterSpacing: '-0.01em' }}>
            Everything a rental host needs
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '20px 18px', border: '0.5px solid #f0ede8', borderRadius: 14, background: '#fafaf9' }}>
                <span style={{ fontSize: 26, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{f.title}</p>
                  <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section ref={pricingRef} style={{ padding: '80px 24px', background: '#f8f7f4' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#185fa5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Pricing</p>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.01em' }}>Simple, flat pricing</h2>
          <p style={{ fontSize: 15, color: '#666', marginBottom: 40 }}>One plan, everything included. Cancel any time.</p>

          <div style={{
            background: '#fff', border: '0.5px solid #e5e3de', borderRadius: 20,
            padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Blue accent bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #185fa5, #1577d4)' }} />

            {trialDays > 0 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#e6f4ea', color: '#15803d', border: '1px solid #bbf7d0',
                borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700, marginBottom: 20,
              }}>
                ✓ {trialDays}-day free trial included
              </div>
            )}

            <p style={{ fontSize: 14, fontWeight: 700, color: '#185fa5', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {plan?.name || 'TollSync Pro'}
            </p>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: '#1a1a1a' }}>
                {price ? `$${price}` : '—'}
              </span>
              <span style={{ fontSize: 16, color: '#888', paddingBottom: 8 }}>/month</span>
            </div>
            {plan?.description && (
              <p style={{ fontSize: 13, color: '#888', marginBottom: 28 }}>{plan.description}</p>
            )}

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', textAlign: 'left' }}>
              {[
                'Unlimited trips & toll records',
                'Multi-vehicle support',
                'AI-powered document parsing',
                'Screenshot, PDF & CSV uploads',
                'Export toll receipts as images',
                'EZ-Pass & major toll providers',
              ].map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '0.5px solid #f5f3f0', fontSize: 14, color: '#333' }}>
                  <span style={{ color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => navigate('/login')}
              style={{
                width: '100%', background: 'linear-gradient(135deg, #185fa5, #1577d4)',
                color: '#fff', border: 'none', borderRadius: 12, padding: '16px 0',
                fontSize: 16, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(24,95,165,0.35)',
              }}
            >
              Start {trialDays > 0 ? `${trialDays}-day free trial` : 'now'} →
            </button>
            <p style={{ fontSize: 12, color: '#aaa', marginTop: 12 }}>
              {trialDays > 0 ? 'No credit card required for trial. ' : ''}Cancel any time.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0d2f5e 0%, #185fa5 100%)',
        padding: '64px 24px', textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, color: '#fff', marginBottom: 16, letterSpacing: '-0.01em' }}>
          Ready to get every toll back?
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 32 }}>
          Join rental hosts who use TollSync to bill accurately and save time.
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{
            background: '#fff', color: '#185fa5', border: 'none', borderRadius: 10,
            padding: '14px 36px', fontSize: 16, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }}
        >
          Get started free →
        </button>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: '#111', color: 'rgba(255,255,255,0.5)', padding: '36px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 4 }}>⚡ TollSync</div>
            <p style={{ fontSize: 13 }}>Rental toll calculator for car rental hosts</p>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
            <a href="/privacy" style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
              onClick={e => { e.preventDefault(); navigate('/privacy'); }}>Privacy Policy</a>
            <a href="/terms" style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
              onClick={e => { e.preventDefault(); navigate('/terms'); }}>Terms & Conditions</a>
            <a href="/contact" style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
              onClick={e => { e.preventDefault(); navigate('/contact'); }}>Contact</a>
            <a href="/login" style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
              onClick={e => { e.preventDefault(); navigate('/login'); }}>Sign in</a>
          </div>
        </div>
        <div style={{ maxWidth: 900, margin: '20px auto 0', borderTop: '0.5px solid rgba(255,255,255,0.08)', paddingTop: 20, fontSize: 12, textAlign: 'center' }}>
          © {new Date().getFullYear()} TollSync. Not affiliated with any rental platform, EZ-Pass, or toll authority.
        </div>
      </footer>
    </div>
  );
}
