import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const SUBJECTS = [
  'General question',
  'Billing issue',
  'Upload problem',
  'Toll matching issue',
  'Feature request',
  'Bug report',
  'Account issue',
  'Other',
];

export default function ContactPage() {
  const { host } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: host?.name || '',
    email: host?.email || '',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const set = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    if (!form.subject) { setError('Please select a subject'); return; }
    setSending(true); setError('');
    try {
      await api.post('/contact', { ...form, host_id: host?.id || null });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send — please try again');
    } finally { setSending(false); }
  };

  if (sent) {
    return (
      <div>
        <div className="page-header">
          <h2>Chat with us</h2>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
          <p style={{ fontWeight: 700, fontSize: 17, margin: '0 0 8px' }}>Message sent!</p>
          <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px', lineHeight: 1.6 }}>
            We got your message and will reply to <strong>{form.email}</strong> within one business day.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Calculator</button>
            <button className="btn" onClick={() => { setSent(false); setForm(f => ({ ...f, subject: '', message: '' })); }}>
              Send another message
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Chat with us</h2>
        <p>We read every message and typically respond within one business day.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { icon: '⏱️', title: 'Response time', desc: 'Within 1 business day' },
          { icon: '✉️', title: 'Email us directly', desc: 'support@tollsync.app' },
          { icon: '📖', title: 'Browse the FAQ', desc: 'Most answers are there', action: () => navigate('/support') },
        ].map((item, i) => (
          <div key={i} className="card"
            style={{ padding: '14px 16px', cursor: item.action ? 'pointer' : 'default' }}
            onClick={item.action}>
            <p style={{ fontSize: 20, margin: '0 0 6px' }}>{item.icon}</p>
            <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 2px' }}>{item.title}</p>
            <p style={{ fontSize: 12, color: item.action ? '#185fa5' : '#888', margin: 0 }}>{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="card">
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px 12px', marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 4, display: 'block' }}>
                Your name
              </label>
              <input className="form-control" name="name" placeholder="Full name"
                value={form.name} onChange={set} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 4, display: 'block' }}>
                Email address
              </label>
              <input className="form-control" name="email" type="email" placeholder="you@example.com"
                value={form.email} onChange={set} required />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 4, display: 'block' }}>
              Subject
            </label>
            <select className="form-control" name="subject" value={form.subject} onChange={set} required>
              <option value="">Select a topic...</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label style={{ fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 4, display: 'block' }}>
              Message
            </label>
            <textarea
              className="form-control"
              name="message"
              placeholder="Describe your issue or question in as much detail as possible..."
              rows={6}
              style={{ resize: 'vertical', minHeight: 140 }}
              value={form.message}
              onChange={set}
              required
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={sending}
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
            {sending ? <><span className="spinner" /> Sending...</> : 'Send message'}
          </button>
          <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 10 }}>
            We'll reply to your email address above.
          </p>
        </form>
      </div>
    </div>
  );
}
