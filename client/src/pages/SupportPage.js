import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FAQS = [
  {
    category: 'Getting started',
    items: [
      {
        q: 'What files can I upload?',
        a: 'TollSync accepts EZ-Pass PDFs, CSVs, and screenshots for toll records — and screenshots or PDFs of your Turo trip list. You can upload multiple files at once. The AI figures out which is which automatically.',
      },
      {
        q: 'How does the toll matching work?',
        a: 'TollSync matches each toll transaction to a trip by checking whether the toll timestamp falls within the trip\'s start and end date/time, and whether the transponder ID belongs to the vehicle on that trip.',
      },
      {
        q: 'What is a transponder ID and where do I find it?',
        a: 'Your transponder ID is the unique number on your EZ-Pass tag. It appears on every line of your EZ-Pass statement. You\'ll need to enter it once per vehicle in the Vehicles page so TollSync can link tolls to the right car.',
      },
      {
        q: 'Can I upload multiple EZ-Pass statements?',
        a: 'Yes. Upload as many statements as you need — TollSync deduplicates tolls automatically so the same charge won\'t appear twice even if your statements overlap.',
      },
    ],
  },
  {
    category: 'Vehicles & transponders',
    items: [
      {
        q: 'How do I add a vehicle?',
        a: 'Go to the Vehicles page and tap "Add vehicle." Enter the year, make, model, license plate, and EZ-Pass transponder ID. The transponder ID is required for toll matching to work.',
      },
      {
        q: 'I have multiple transponders for the same car — is that supported?',
        a: 'Currently each vehicle has one transponder ID. If you have a backup tag, add it as a separate vehicle entry with the same plate and YMM but the second transponder ID.',
      },
      {
        q: 'What if a renter used a vehicle I haven\'t added yet?',
        a: 'TollSync will prompt you to enter the vehicle details and transponder ID when it encounters an unknown vehicle in your trip data. You can resolve this from the Calculator page without losing any data.',
      },
    ],
  },
  {
    category: 'EZ-Pass & toll records',
    items: [
      {
        q: 'My EZ-Pass PDF upload failed — what should I do?',
        a: 'Large statements (10+ pages) are parsed natively without AI. If you see an error, try splitting the PDF into smaller chunks, or export a CSV from your EZ-Pass account instead — CSVs are the most reliable format.',
      },
      {
        q: 'Some tolls are showing up twice — why?',
        a: 'This can happen if two uploaded files overlap (e.g. monthly and quarterly statements). TollSync deduplicates based on transponder, amount, and timestamp. If duplicates still appear, try deleting all toll records from that period and re-uploading a single authoritative file.',
      },
      {
        q: 'Which EZ-Pass states and agencies are supported?',
        a: 'TollSync works with any EZ-Pass-compatible statement including E-ZPass, SunPass, TxTag, and others. The AI parser handles most PDF and image formats. The native high-speed parser is optimized for E-ZPass Virginia and similar column-based PDFs.',
      },
    ],
  },
  {
    category: 'Trips',
    items: [
      {
        q: 'How do I upload my trip list?',
        a: 'Take a screenshot of your Turo trips page (the list view showing all rentals) and upload it on the Calculator or Trips page. TollSync reads renter names, vehicles, and dates automatically.',
      },
      {
        q: 'A trip is showing as "Ongoing" — will tolls still be counted?',
        a: 'Yes. TollSync calculates tolls up to the current moment for ongoing trips. The total will increase as new toll records are uploaded while the trip is still active.',
      },
      {
        q: 'Can I delete a trip?',
        a: 'Yes — go to the Trips page, find the trip, and use the delete option. Deleting a trip removes it from calculations but does not delete the associated toll records.',
      },
    ],
  },
  {
    category: 'Billing & subscription',
    items: [
      {
        q: 'How do I cancel my subscription?',
        a: 'Go to Billing (the 💳 icon) and tap "Manage billing." This opens the Stripe billing portal where you can cancel anytime. Your access continues until the end of the current billing period.',
      },
      {
        q: 'Do you offer refunds?',
        a: 'We do not offer refunds for partial billing periods. If you believe there was a billing error, contact us and we\'ll review it.',
      },
      {
        q: 'Is my payment information stored by TollSync?',
        a: 'No. Payments are processed by Stripe. TollSync never sees or stores your card details.',
      },
    ],
  },
  {
    category: 'Privacy & data',
    items: [
      {
        q: 'Who can see my uploaded files?',
        a: 'Only you. Your uploaded documents and toll data are scoped to your account and are never shared with other users or third parties.',
      },
      {
        q: 'How long is my data retained?',
        a: 'Your data is retained as long as your account is active. If you close your account, contact support and we will delete your data within 30 days.',
      },
      {
        q: 'Does TollSync use AI to read my documents?',
        a: 'Yes — for images and screenshots, TollSync uses AI vision to extract the relevant data. For structured PDFs like E-ZPass statements, we use a native parser that doesn\'t send your data to an AI model.',
      },
    ],
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '0.5px solid #f0ede8' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '13px 0', gap: 12, textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', flex: 1 }}>{q}</span>
        <span style={{ fontSize: 12, color: '#aaa', flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>
      {open && (
        <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, margin: '0 0 13px', paddingRight: 24 }}>{a}</p>
      )}
    </div>
  );
}

export default function SupportPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header">
        <h2>Support</h2>
        <p>Answers to the most common questions.</p>
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <button className="btn btn-sm" onClick={() => navigate('/contact')}>✉️ Contact us</button>
        <button className="btn btn-sm" onClick={() => navigate('/about')}>ℹ️ About TollSync</button>
      </div>

      {FAQS.map(section => (
        <div key={section.category} style={{ marginBottom: 20 }}>
          <p className="section-title">{section.category}</p>
          <div className="card" style={{ padding: '0 20px' }}>
            {section.items.map(item => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      ))}

      {/* Still stuck CTA */}
      <div className="card" style={{ textAlign: 'center', padding: '24px 20px', background: 'linear-gradient(135deg, #e8f0fb 0%, #f0f4fa 100%)', border: 'none' }}>
        <p style={{ fontSize: 22, marginBottom: 8 }}>💬</p>
        <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 6px' }}>Still stuck?</p>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px' }}>We typically respond within one business day.</p>
        <button className="btn btn-primary" onClick={() => navigate('/contact')}>Send us a message</button>
      </div>
    </div>
  );
}
