import React from 'react';
import { useNavigate } from 'react-router-dom';

const steps = [
  { icon: '📸', title: 'Upload trip screenshots', desc: 'Take a screenshot of your Turo trip list and upload it. TollSync reads the renter name, dates, and vehicle automatically.' },
  { icon: '📄', title: 'Upload your EZ-Pass statement', desc: 'Drop in your monthly EZ-Pass PDF, CSV, or a screenshot. Our AI parses every transaction — no manual entry.' },
  { icon: '⚡', title: 'Get instant results', desc: 'TollSync matches each toll to the right renter based on date and vehicle. Export a clean report to share or keep for records.' },
];

const values = [
  { icon: '🎯', title: 'Accuracy first', desc: 'We flag coverage gaps and always remind you to verify results before billing anyone.' },
  { icon: '🔒', title: 'Your data stays yours', desc: 'We never sell your data. Uploaded files are used solely to provide the service and nothing else.' },
  { icon: '⚡', title: 'Built for hosts', desc: 'Every feature — from smart transponder matching to exportable reports — was designed around how real hosts actually work.' },
  { icon: '🛠️', title: 'Always improving', desc: 'We ship updates constantly. If something is broken or missing, we want to hear about it.' },
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header">
        <h2>About TollSync</h2>
        <p>Built for rental hosts who are tired of calculating tolls by hand.</p>
      </div>

      {/* Mission */}
      <div className="card" style={{ marginBottom: 20, padding: '24px 24px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#185fa5', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Our mission</p>
        <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.6, margin: '0 0 12px', color: '#1a1a1a' }}>
          Make toll reimbursement effortless for every peer-to-peer car rental host.
        </p>
        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, margin: 0 }}>
          Rental hosts spend hours every month cross-referencing EZ-Pass statements against trip records to figure out who owes what. TollSync automates all of it — upload your files, and within seconds you have an itemized report per renter. No spreadsheets. No guesswork.
        </p>
      </div>

      {/* How it works */}
      <p className="section-title">How it works</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {steps.map((s, i) => (
          <div key={i} className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '16px 20px' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: '#e8f0fb', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 18,
            }}>{s.icon}</div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 4px' }}>
                <span style={{ color: '#185fa5', marginRight: 6 }}>{i + 1}.</span>{s.title}
              </p>
              <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Values */}
      <p className="section-title">What we stand for</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
        {values.map((v, i) => (
          <div key={i} className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 22, margin: '0 0 8px' }}>{v.icon}</p>
            <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 5px' }}>{v.title}</p>
            <p style={{ fontSize: 12, color: '#666', margin: 0, lineHeight: 1.6 }}>{v.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => navigate('/support')}>View Support</button>
        <button className="btn" onClick={() => navigate('/contact')}>Contact us</button>
      </div>
    </div>
  );
}
