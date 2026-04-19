import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CAR_YEARS, CAR_MAKES, CAR_MODELS } from '../data/carData';


const EMPTY_VEHICLE = () => ({
  nickname: '', year: '', make: '', model: '', freeformMake: '', freeformModel: '',
  plate: '', transponder_id: '', vin: '',
});

const label = { fontSize: 13, color: '#555', marginBottom: 4, display: 'block', fontWeight: 500 };
const req = <span style={{ color: '#e24b4a' }}>*</span>;
const errStyle = { border: '1.5px solid #e24b4a' };
const errMsg = (msg) => <p style={{ fontSize: 11, color: '#e24b4a', marginTop: 3 }}>{msg}</p>;

function VehicleForm({ v, idx, onChange, onRemove, showRemove, isMobile, submitted, formRef }) {
  const models = v.make && v.make !== 'Other' ? (CAR_MODELS[v.make] || []) : [];
  const set = patch => onChange(idx, patch);

  const makeName = v.make === 'Other' ? v.freeformMake.trim() : v.make;
  const modelName = v.make === 'Other'
    ? v.freeformModel.trim()
    : v.model === 'Other' ? v.freeformModel.trim() : v.model;

  const err = submitted ? {
    nickname: !v.nickname.trim(),
    year: !v.year,
    make: !v.make,
    freeformMake: v.make === 'Other' && !v.freeformMake.trim(),
    model: v.make && v.make !== 'Other' && !v.model,
    freeformModel: (v.make === 'Other' || v.model === 'Other') && !v.freeformModel.trim(),
    plate: !v.plate.trim(),
    transponder_id: !v.transponder_id.trim(),
  } : {};

  const hasErrors = submitted && !isVehicleValid(v);
  const missingFields = hasErrors ? [
    err.nickname && 'Nickname',
    (err.year || err.make || err.freeformMake || err.model || err.freeformModel) && 'Year / Make / Model',
    err.plate && 'License plate',
    err.transponder_id && 'EZ-Pass transponder',
  ].filter(Boolean) : [];

  return (
    <div ref={formRef} style={{
      background: '#fff', borderRadius: 14,
      border: hasErrors ? '1.5px solid #e24b4a' : '0.5px solid #e5e3de',
      padding: isMobile ? '16px' : '20px', marginBottom: 12, position: 'relative',
    }}>
      {showRemove && (
        <button onClick={() => onRemove(idx)} style={{
          position: 'absolute', top: 14, right: 14,
          background: '#f0ede8', border: 'none', color: '#888',
          width: 28, height: 28, borderRadius: 99, cursor: 'pointer',
          fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      )}

      <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 14px', color: '#185fa5' }}>
        Vehicle {idx + 1}
      </p>

      {missingFields.length > 0 && (
        <div style={{
          background: '#fff5f5', border: '1px solid #f5c6c6', borderRadius: 8,
          padding: '10px 12px', marginBottom: 14,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ color: '#e24b4a', fontSize: 15, flexShrink: 0, marginTop: 1 }}>⚠</span>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#c0392b', margin: '0 0 3px' }}>
              Please fill in the required fields:
            </p>
            <p style={{ fontSize: 12, color: '#c0392b', margin: 0 }}>
              {missingFields.join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Nickname */}
      <div className="form-group">
        <label style={{ ...label, color: err.nickname ? '#e24b4a' : '#555' }}>Nickname {req}</label>
        <input className="form-control" placeholder="e.g. Blue Nissan, Family SUV"
          style={{ fontSize: 16, ...(err.nickname ? errStyle : {}) }}
          value={v.nickname}
          onChange={e => set({ nickname: e.target.value })} />
        {err.nickname ? errMsg('Nickname is required') : (
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>This is how you'll identify the car later</p>
        )}
      </div>

      {/* Year */}
      <div className="form-group">
        <label style={{ ...label, color: err.year ? '#e24b4a' : '#555' }}>Year {req}</label>
        <select className="form-control" style={{ fontSize: 16, ...(err.year ? errStyle : {}) }}
          value={v.year} onChange={e => set({ year: e.target.value })}>
          <option value="">Select year</option>
          {CAR_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {err.year && errMsg('Year is required')}
      </div>

      {/* Make */}
      <div className="form-group">
        <label style={{ ...label, color: err.make ? '#e24b4a' : '#555' }}>Make {req}</label>
        <select className="form-control" style={{ fontSize: 16, ...(err.make ? errStyle : {}) }}
          value={v.make}
          onChange={e => set({ make: e.target.value, model: '', freeformMake: '', freeformModel: '' })}>
          <option value="">Select make</option>
          {CAR_MAKES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {err.make && errMsg('Make is required')}
      </div>

      {/* Make free-form (Other) */}
      {v.make === 'Other' && (
        <div className="form-group">
          <label style={{ ...label, color: err.freeformMake ? '#e24b4a' : '#555' }}>Make name {req}</label>
          <input className="form-control" placeholder="e.g. Tesla" style={{ fontSize: 16, ...(err.freeformMake ? errStyle : {}) }}
            value={v.freeformMake} onChange={e => set({ freeformMake: e.target.value })} />
          {err.freeformMake && errMsg('Make name is required')}
        </div>
      )}

      {/* Model */}
      {v.make && v.make !== 'Other' && (
        <div className="form-group">
          <label style={{ ...label, color: err.model ? '#e24b4a' : '#555' }}>Model {req}</label>
          <select className="form-control" style={{ fontSize: 16, ...(err.model ? errStyle : {}) }}
            value={v.model} onChange={e => set({ model: e.target.value, freeformModel: '' })}>
            <option value="">Select model</option>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {err.model && errMsg('Model is required')}
        </div>
      )}

      {/* Model free-form */}
      {((v.make === 'Other') || (v.make && v.model === 'Other')) && (
        <div className="form-group">
          <label style={{ ...label, color: err.freeformModel ? '#e24b4a' : '#555' }}>Model name {req}</label>
          <input className="form-control" placeholder="e.g. Model 3" style={{ fontSize: 16, ...(err.freeformModel ? errStyle : {}) }}
            value={v.freeformModel} onChange={e => set({ freeformModel: e.target.value })} />
          {err.freeformModel && errMsg('Model name is required')}
        </div>
      )}

      {/* Plate */}
      <div className="form-group">
        <label style={{ ...label, color: err.plate ? '#e24b4a' : '#555' }}>License Plate {req}</label>
        <input className="form-control" placeholder="ABC1234"
          style={{ fontFamily: 'monospace', textTransform: 'uppercase', fontSize: 16, letterSpacing: 1, ...(err.plate ? errStyle : {}) }}
          value={v.plate}
          onChange={e => set({ plate: e.target.value.toUpperCase() })} />
        {err.plate && errMsg('License plate is required')}
      </div>

      {/* Transponder */}
      <div className="form-group">
        <label style={{ ...label, color: err.transponder_id ? '#e24b4a' : '#555' }}>EZ-Pass Transponder {req}</label>
        <input className="form-control" placeholder="Transponder ID"
          style={{ fontFamily: 'monospace', fontSize: 16, ...(err.transponder_id ? errStyle : {}) }}
          value={v.transponder_id}
          onChange={e => set({ transponder_id: e.target.value })} />
        {err.transponder_id && errMsg('Transponder ID is required')}
      </div>

      {/* VIN */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label style={label}>VIN <span style={{ color: '#aaa', fontWeight: 400 }}>(optional)</span></label>
        <input className="form-control" placeholder="17-character VIN"
          style={{ fontFamily: 'monospace', textTransform: 'uppercase', fontSize: 16 }}
          value={v.vin}
          onChange={e => set({ vin: e.target.value.toUpperCase() })} />
      </div>
    </div>
  );
}

function isVehicleValid(v) {
  if (!v.nickname.trim()) return false;
  if (!v.year) return false;
  const makeName = v.make === 'Other' ? v.freeformMake.trim() : v.make;
  if (!makeName) return false;
  const modelName = v.make === 'Other'
    ? v.freeformModel.trim()
    : v.model === 'Other' ? v.freeformModel.trim() : v.model;
  if (!modelName) return false;
  if (!v.plate.trim()) return false;
  if (!v.transponder_id.trim()) return false;
  return true;
}

const TERMS_TEXT = [
  {
    title: '1. Acceptance of Terms',
    body: `By creating an account and using TollSync, you ("User," "Host," or "you") agree to be bound by these Terms and Conditions ("Terms"), our Privacy Policy, and all applicable laws and regulations. If you do not agree with any part of these Terms, you must not access or use TollSync. These Terms constitute a legally binding agreement between you and TollSync ("Company," "we," "us," or "our"). Your continued use of the Service after any modification to these Terms constitutes your acceptance of the updated Terms.`,
  },
  {
    title: '2. Description of Service',
    body: `TollSync is a software-as-a-service (SaaS) platform designed to assist peer-to-peer vehicle rental hosts in calculating, tracking, and documenting toll charges incurred during rental periods. The Service uses artificial intelligence (AI) and optical character recognition (OCR) technology to parse documents uploaded by users, including but not limited to EZ-Pass statements, trip screenshots, and CSV files. TollSync is an independent service and is not affiliated with, endorsed by, or in any way officially connected to Turo, Inc., any toll authority, state or municipal transportation agency, or any other rental platform.`,
  },
  {
    title: '3. Eligibility',
    body: `You must be at least 18 years of age to use TollSync. By creating an account, you represent and warrant that you are at least 18 years old, have the legal capacity to enter into binding contracts, are using the Service for lawful purposes only, and that all information you provide during registration is accurate, current, and complete. TollSync reserves the right to suspend or terminate accounts where eligibility requirements are not met.`,
  },
  {
    title: '4. User Accounts & Security',
    body: `You are responsible for maintaining the confidentiality of your account credentials, including your password. You agree to: (a) provide accurate and complete registration information; (b) notify TollSync immediately of any unauthorized access to or use of your account; (c) ensure that you log out of your account at the end of each session when using shared devices. TollSync is not liable for any loss or damage arising from your failure to comply with these security obligations. You may not transfer your account to another person or entity without prior written consent from TollSync.`,
  },
  {
    title: '5. Subscription & Billing',
    body: `Access to the full features of TollSync requires an active paid subscription. Subscriptions are billed on a recurring monthly basis and will automatically renew at the end of each billing period unless cancelled. By subscribing, you authorize TollSync (through its payment processor, Stripe) to charge your payment method on a recurring basis. Prices are subject to change with at least 30 days' prior notice. All fees are stated in US Dollars and are exclusive of applicable taxes, which you are solely responsible for paying. TollSync uses Stripe, Inc. as its third-party payment processor. Your payment information is transmitted directly to Stripe and is not stored by TollSync.`,
  },
  {
    title: '6. Free Trials',
    body: `Where a free trial is offered, it begins on the date you subscribe and ends on the date specified at the time of sign-up. At the end of the free trial period, your subscription will automatically convert to a paid subscription and you will be charged the applicable fee unless you cancel before the trial ends. Only one free trial is available per user, per household, and per payment method. TollSync reserves the right to determine eligibility for free trials and to modify or discontinue trial offers at any time.`,
  },
  {
    title: '7. Cancellation & Refund Policy',
    body: `You may cancel your subscription at any time through the billing portal accessible from within your account. Upon cancellation, your subscription will remain active until the end of the current billing period. No refunds or credits are provided for partial billing periods, unused features, or any other reason, except where required by applicable law. TollSync reserves the right to issue refunds or credits at its sole discretion. Cancellation does not delete your account or uploaded data immediately; your data will be retained in accordance with our data retention policy.`,
  },
  {
    title: '8. Acceptable Use',
    body: `You agree to use TollSync only for lawful purposes and in a manner that does not infringe the rights of others. You must not: (a) use the Service to upload, transmit, or store any content that is illegal, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable; (b) attempt to gain unauthorized access to TollSync systems, servers, or networks; (c) use automated scripts, bots, or other automated means to access the Service without our express written consent; (d) reverse engineer, decompile, disassemble, or otherwise attempt to derive source code from the Service; (e) use the Service in any manner that could disable, damage, or impair the Service or interfere with other users' use; (f) share, resell, or sublicense access to the Service to third parties; or (g) use the Service to engage in fraudulent activities, including submitting false toll charges to renters.`,
  },
  {
    title: '9. Data Accuracy & User Responsibility',
    body: `You are solely responsible for the accuracy, completeness, and legality of all data you upload to TollSync, including toll statements, trip records, vehicle information, and renter data. TollSync's AI-powered parsing technology may produce errors, misinterpretations, or omissions. YOU ACKNOWLEDGE THAT ALL PARSED RESULTS MUST BE INDEPENDENTLY VERIFIED BY YOU BEFORE USE FOR ANY PURPOSE, INCLUDING BILLING RENTERS. TollSync expressly disclaims any liability arising from your reliance on parsed results without independent verification. It is your responsibility to ensure that any charges passed on to renters are accurate, lawful, and properly documented under the terms of your rental agreement.`,
  },
  {
    title: '10. Renter Billing Compliance',
    body: `You acknowledge and agree that you are solely responsible for compliance with applicable laws, regulations, and platform policies (including those of Turo, Inc. or any other rental platform) when billing renters for toll charges. TollSync provides a calculation tool only and does not constitute legal advice or authorization to charge renters. You represent that you have the legal right and contractual authority to charge renters for any tolls identified through the Service. TollSync is not responsible for any disputes arising between you and your renters.`,
  },
  {
    title: '11. Intellectual Property',
    body: `All content, features, and functionality of TollSync — including but not limited to software, text, graphics, logos, icons, and the arrangement thereof — are the exclusive property of TollSync and its licensors and are protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property laws. You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Service solely for its intended purpose during the term of your subscription. You may not copy, modify, distribute, sell, or lease any part of the Service or its content without our prior written permission.`,
  },
  {
    title: '12. User-Uploaded Content',
    body: `By uploading content to TollSync (including EZ-Pass statements, screenshots, and other documents), you grant TollSync a limited, non-exclusive, royalty-free license to store, process, and analyze such content solely for the purpose of providing the Service to you. You represent and warrant that you have all necessary rights to upload such content and that doing so does not violate any third-party rights or applicable laws. TollSync does not claim ownership of your uploaded content. You are responsible for ensuring that any personally identifiable information contained in uploaded documents is handled in compliance with applicable privacy laws.`,
  },
  {
    title: '13. Privacy & Data Processing',
    body: `TollSync collects, stores, and processes personal information in accordance with our Privacy Policy, which is incorporated into these Terms by reference. By using the Service, you consent to the collection and processing of your data as described in the Privacy Policy. We implement industry-standard security measures to protect your data but cannot guarantee absolute security. You acknowledge that transmitting information over the internet carries inherent risks. TollSync does not sell, rent, or share your personal information with third parties for their own marketing purposes. Data may be shared with trusted service providers (such as Stripe and AI processing partners) solely to the extent necessary to provide the Service.`,
  },
  {
    title: '14. Third-Party Services',
    body: `TollSync integrates with third-party services including Stripe (payment processing) and AI inference providers (document parsing). Your use of these third-party services is subject to their own terms of service and privacy policies. TollSync is not responsible for the acts, omissions, or policies of any third-party service provider. Stripe's services are governed by the Stripe Services Agreement available at stripe.com. TollSync is not responsible for any disruption, outage, or error caused by third-party services.`,
  },
  {
    title: '15. Disclaimer of Warranties',
    body: `THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, TOLLSYNC DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. TOLLSYNC DOES NOT WARRANT THAT: (A) THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE; (B) THE RESULTS OBTAINED FROM THE SERVICE WILL BE ACCURATE OR RELIABLE; (C) ANY ERRORS IN THE SERVICE WILL BE CORRECTED; OR (D) THE SERVICE WILL MEET YOUR REQUIREMENTS.`,
  },
  {
    title: '16. Limitation of Liability',
    body: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL TOLLSYNC, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITIES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF TOLLSYNC HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. IN NO EVENT SHALL TOLLSYNC'S TOTAL CUMULATIVE LIABILITY TO YOU EXCEED THE GREATER OF (A) THE TOTAL FEES PAID BY YOU TO TOLLSYNC IN THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED US DOLLARS ($100.00). SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF INCIDENTAL OR CONSEQUENTIAL DAMAGES, SO THE ABOVE LIMITATIONS MAY NOT APPLY TO YOU.`,
  },
  {
    title: '17. Indemnification',
    body: `You agree to defend, indemnify, and hold harmless TollSync and its officers, directors, employees, agents, and licensors from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising from: (a) your use of or access to the Service; (b) your violation of these Terms; (c) your violation of any third-party right, including any intellectual property right or privacy right; (d) any claim that content you uploaded to the Service caused damage to a third party; (e) any disputes between you and your renters arising from toll charges generated using the Service; or (f) your violation of any applicable law or regulation. This indemnification obligation will survive termination of these Terms and your use of the Service.`,
  },
  {
    title: '18. Governing Law & Dispute Resolution',
    body: `These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any dispute, claim, or controversy arising out of or relating to these Terms or the Service shall first be subject to informal negotiation for a period of 30 days. If the dispute is not resolved through informal negotiation, it shall be submitted to binding arbitration administered by the American Arbitration Association (AAA) under its Consumer Arbitration Rules. Arbitration shall take place on an individual basis; class actions and class arbitrations are not permitted. The arbitrator's award shall be final and binding and may be entered as a judgment in any court of competent jurisdiction. Notwithstanding the foregoing, either party may seek injunctive or other equitable relief in a court of competent jurisdiction.`,
  },
  {
    title: '19. Termination',
    body: `TollSync reserves the right to suspend or terminate your account and access to the Service at any time, with or without cause, and with or without notice. Grounds for termination include, but are not limited to, violation of these Terms, fraudulent activity, non-payment, or conduct that TollSync determines, in its sole discretion, to be harmful to the Service, other users, or third parties. Upon termination, your right to use the Service will immediately cease. Provisions of these Terms that by their nature should survive termination shall survive, including sections on intellectual property, disclaimer of warranties, limitation of liability, and indemnification.`,
  },
  {
    title: '20. Modifications to the Service',
    body: `TollSync reserves the right to modify, suspend, or discontinue any aspect of the Service at any time, with or without notice. TollSync shall not be liable to you or any third party for any modification, suspension, or discontinuance of the Service. We will endeavor to provide reasonable advance notice of material changes that significantly affect your use of the Service, but we are not obligated to do so.`,
  },
  {
    title: '21. Changes to These Terms',
    body: `TollSync reserves the right to update or modify these Terms at any time. When we make material changes, we will notify you by email or by displaying a prominent notice within the Service. The date of the most recent revision will be indicated at the top of this document. Your continued use of the Service after the effective date of any changes constitutes your acceptance of the revised Terms. If you do not agree to the updated Terms, you must stop using the Service and cancel your subscription.`,
  },
  {
    title: '22. Severability',
    body: `If any provision of these Terms is found to be unlawful, void, or unenforceable for any reason, that provision shall be deemed severable from these Terms and shall not affect the validity and enforceability of the remaining provisions.`,
  },
  {
    title: '23. Entire Agreement',
    body: `These Terms, together with the Privacy Policy and any other agreements expressly incorporated by reference herein, constitute the entire agreement between you and TollSync relating to the Service and supersede all prior agreements, representations, warranties, and understandings with respect to the Service.`,
  },
  {
    title: '24. Contact Information',
    body: `If you have any questions about these Terms, please contact us at: TollSync Support · support@tollsync.app. We will endeavor to respond to all inquiries within five (5) business days.`,
  },
];

const STEPS = [
  { n: 1, label: 'Subscribe' },
  { n: 2, label: 'Terms & Conditions' },
  { n: 3, label: 'Add vehicles' },
  { n: 4, label: 'EZ-Pass' },
];

export default function SetupWizard() {
  const { completeSetup, logout } = useAuth();

  // Restore step after Stripe redirect (sessionStorage)
  const initStep = () => {
    const saved = sessionStorage.getItem('wizard_step');
    const urlParams = new URLSearchParams(window.location.search);
    if (saved && urlParams.get('session_id')) return parseInt(saved, 10);
    return 1;
  };

  const [step, setStep] = useState(initStep);
  const [verifyingSession, setVerifyingSession] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const [vehicles, setVehicles] = useState([EMPTY_VEHICLE()]);
  const [submitted, setSubmitted] = useState(false);
  const vehicleRefs = useRef([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [plan, setPlan] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [finishing, setFinishing] = useState(false);

  // T&C state
  const [scrolledTerms, setScrolledTerms] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const termsRef = useRef(null);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    api.get('/billing/plan').then(r => setPlan(r.data)).catch(() => {});
  }, []);

  // After Stripe redirect: verify the session, then advance
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    if (!sessionId) return;

    setVerifyingSession(true);
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await api.get(`/billing/verify-session?session_id=${sessionId}`);
        const status = res.data.subscription_status;
        if (status === 'active' || status === 'trialing') {
          clearInterval(poll);
          sessionStorage.removeItem('wizard_step');
          // Clean the URL without reloading
          window.history.replaceState({}, '', '/');
          setVerifyingSession(false);
          setStep(2); // advance to T&C
        }
      } catch (err) {
        if (err.response?.data?.error) {
          clearInterval(poll);
          setVerifyError(err.response.data.error);
          setVerifyingSession(false);
        }
      }
      if (attempts >= 8) {
        clearInterval(poll);
        setVerifyError('Could not confirm payment. Please contact support.');
        setVerifyingSession(false);
      }
    }, 2000);
    return () => clearInterval(poll);
  }, []); // eslint-disable-line

  // Reset T&C scroll state when entering step 2
  useEffect(() => {
    if (step === 2) {
      setScrolledTerms(false);
      setAgreedTerms(false);
      setTimeout(() => {
        const el = termsRef.current;
        if (el && el.scrollHeight <= el.clientHeight + 10) setScrolledTerms(true);
      }, 100);
    }
  }, [step]);

  const handleTermsScroll = useCallback(() => {
    const el = termsRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 16) setScrolledTerms(true);
  }, []);

  const updateVehicle = (idx, patch) =>
    setVehicles(vs => vs.map((v, i) => i === idx ? { ...v, ...patch } : v));
  const removeVehicle = (idx) => setVehicles(vs => vs.filter((_, i) => i !== idx));
  const addVehicle = () => setVehicles(vs => [...vs, EMPTY_VEHICLE()]);

  const allValid = vehicles.length > 0 && vehicles.every(isVehicleValid);

  // Step 1: redirect to Stripe
  const startSubscription = async () => {
    setSubscribing(true); setSubscribeError('');
    try {
      sessionStorage.setItem('wizard_step', '2');
      const res = await api.post('/billing/checkout', { from: 'wizard' });
      window.location.href = res.data.url;
    } catch (err) {
      sessionStorage.removeItem('wizard_step');
      setSubscribeError(err.response?.data?.error || 'Failed to start checkout');
      setSubscribing(false);
    }
  };

  // Step 3: save vehicles then advance
  const saveVehicles = async () => {
    setSubmitted(true);
    if (!allValid) {
      const firstInvalidIdx = vehicles.findIndex(v => !isVehicleValid(v));
      const el = vehicleRefs.current[firstInvalidIdx];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setSaving(true); setSaveError('');
    try {
      for (const v of vehicles) {
        const makeName = v.make === 'Other' ? v.freeformMake.trim() : v.make;
        const modelName = v.make === 'Other'
          ? v.freeformModel.trim()
          : v.model === 'Other' ? v.freeformModel.trim() : v.model;
        await api.post('/vehicles', {
          name: `${v.year} ${makeName} ${modelName}`.trim(),
          nickname: v.nickname.trim(),
          year: v.year, make: makeName, model: modelName,
          plate: v.plate.trim(),
          transponder_id: v.transponder_id.trim(),
          vin: v.vin.trim(),
        });
      }
      setStep(4);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to save vehicles');
    } finally { setSaving(false); }
  };

  const handleTollUpload = async (files) => {
    if (!files || !files.length) return;
    setUploading(true); setUploadError('');
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    try {
      await api.post('/upload/auto', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadDone(true);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  const finish = async () => {
    setFinishing(true);
    try { await completeSetup(); } catch { setFinishing(false); }
  };

  // bottom padding: sticky button height + safe area
  const bottomPad = isMobile ? 'calc(80px + env(safe-area-inset-bottom, 0px))' : '48px';

  const stepHeadings = {
    1: { title: 'Activate your subscription', sub: 'One plan, everything included. Cancel anytime.' },
    2: { title: 'Terms & Conditions', sub: 'Scroll through and read the full terms before agreeing.' },
    3: { title: 'Add your vehicles', sub: 'Add each car you host. TollSync uses this to match toll charges to trips.' },
    4: { title: 'Upload EZ-Pass statement', sub: 'Optional — upload now or anytime later from Toll Records.' },
  };

  // Stripe session verifying overlay
  if (verifyingSession) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4', padding: 24 }}>
        <span className="spinner spinner-lg" style={{ marginBottom: 16 }} />
        <p style={{ color: '#555', fontSize: 15 }}>Activating your subscription...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4' }}>
      <div style={{
        maxWidth: 520, margin: '0 auto',
        padding: `calc(1.5rem + env(safe-area-inset-top, 0px)) 16px ${step === 2 ? (isMobile ? 'calc(140px + env(safe-area-inset-bottom, 0px))' : bottomPad) : bottomPad}`,
      }}>
        {/* Header: logo + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <span style={{ fontWeight: 700, fontSize: 17 }}>TollSync</span>
          </div>
          <button
            onClick={() => logout()}
            style={{ background: 'none', border: 'none', fontSize: 13, color: '#aaa', cursor: 'pointer', padding: '4px 8px' }}>
            Sign out
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, overflowX: 'auto' }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  background: step > s.n ? '#3b6d11' : step === s.n ? '#185fa5' : '#e5e3de',
                  color: step >= s.n ? '#fff' : '#aaa',
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span style={{ fontSize: 10, color: step === s.n ? '#185fa5' : '#aaa', fontWeight: step === s.n ? 600 : 400, whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: step > s.n ? '#3b6d11' : '#e5e3de', margin: '0 6px', marginBottom: 20, minWidth: 16 }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step heading */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, margin: '0 0 6px' }}>{stepHeadings[step].title}</h2>
          <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.5 }}>{stepHeadings[step].sub}</p>
        </div>

        {verifyError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{verifyError}</div>}

        {/* Step 1 — Subscribe */}
        {step === 1 && (
          <div className="card" style={{ padding: 24, marginBottom: 12 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <p style={{ fontWeight: 700, fontSize: 20, margin: '0 0 4px' }}>{plan?.name || 'TollSync Pro'}</p>
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 14px' }}>{plan?.description || 'Unlimited toll calculations for rental hosts'}</p>
              <p style={{ fontSize: 34, fontWeight: 800, color: '#185fa5', margin: 0 }}>
                ${((plan?.price_cents || 1000) / 100).toFixed(2)}/mo
              </p>
              {plan?.trial_days > 0 && (
                <p style={{ fontSize: 13, color: '#3b6d11', fontWeight: 600, margin: '6px 0 0' }}>
                  {plan.trial_days}-day free trial included
                </p>
              )}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              {['Unlimited trip calculations', 'AI-powered file parsing', 'Multi-vehicle support', 'EZ-Pass matching', 'Exportable toll reports'].map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#333' }}>
                  <span style={{ color: '#3b6d11', fontWeight: 700 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            {subscribeError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{subscribeError}</div>}
            {!isMobile && (
              <button className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15 }}
                disabled={subscribing} onClick={startSubscription}>
                {subscribing ? <><span className="spinner" /> Redirecting...</> : plan?.trial_days > 0 ? `Start ${plan.trial_days}-day free trial` : `Subscribe for $${((plan?.price_cents || 1000) / 100).toFixed(2)}/mo`}
              </button>
            )}
            <p style={{ textAlign: 'center', fontSize: 11, color: '#aaa', marginTop: 10 }}>Secure payment via Stripe · Cancel anytime</p>
          </div>
        )}

        {/* Step 2 — T&C */}
        {step === 2 && (
          <>
            <div
              ref={termsRef}
              onScroll={handleTermsScroll}
              style={{
                height: isMobile ? 340 : 420,
                overflowY: 'auto',
                border: '1px solid #e5e3de',
                borderRadius: 12,
                background: '#fff',
                padding: '16px 18px',
                marginBottom: 16,
                fontSize: 12.5,
                lineHeight: 1.75,
                color: '#333',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <p style={{ fontSize: 11, color: '#aaa', marginBottom: 14 }}>Last updated: April 17, 2026</p>
              {TERMS_TEXT.map((section) => (
                <div key={section.title} style={{ marginBottom: 18 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a', margin: '0 0 5px' }}>{section.title}</p>
                  <p style={{ margin: 0 }}>{section.body}</p>
                </div>
              ))}
              <p style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>— End of Terms & Conditions —</p>
            </div>

            {!scrolledTerms && (
              <p style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 12 }}>
                Scroll to the bottom to enable the agreement checkbox
              </p>
            )}

            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '14px 16px',
              background: scrolledTerms ? '#f8f7f4' : '#f3f4f6',
              border: `1px solid ${scrolledTerms ? '#d0daea' : '#e5e3de'}`,
              borderRadius: 10,
              cursor: scrolledTerms ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s, border-color 0.2s',
              marginBottom: 4,
              opacity: scrolledTerms ? 1 : 0.55,
            }}>
              <input type="checkbox" checked={agreedTerms} disabled={!scrolledTerms}
                onChange={e => setAgreedTerms(e.target.checked)}
                style={{ marginTop: 2, width: 17, height: 17, flexShrink: 0, cursor: scrolledTerms ? 'pointer' : 'not-allowed' }} />
              <span style={{ fontSize: 13, color: '#333', lineHeight: 1.55 }}>
                I have read and agree to the TollSync Terms & Conditions. I understand that TollSync is a calculation tool and I am responsible for verifying all results before billing renters.
              </span>
            </label>

            {!isMobile && (
              <button className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, marginTop: 14 }}
                disabled={!agreedTerms} onClick={() => setStep(3)}>
                I agree — Continue →
              </button>
            )}
          </>
        )}

        {/* Step 3 — Add vehicles */}
        {step === 3 && (
          <>
            {vehicles.map((v, idx) => (
              <VehicleForm key={idx} v={v} idx={idx}
                onChange={updateVehicle} onRemove={removeVehicle}
                showRemove={vehicles.length > 1} isMobile={isMobile} submitted={submitted}
                formRef={el => vehicleRefs.current[idx] = el} />
            ))}

            <button className="btn" style={{ width: '100%', justifyContent: 'center', marginBottom: 8, padding: '11px' }}
              onClick={addVehicle}>
              + Add another vehicle
            </button>

            {saveError && <div className="alert alert-error" style={{ marginTop: 8 }}>{saveError}</div>}

            {!isMobile && (
              <button className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, marginTop: 8 }}
                disabled={saving} onClick={saveVehicles}>
                {saving ? <><span className="spinner" /> Saving...</> : 'Next →'}
              </button>
            )}
          </>
        )}

        {/* Step 4 — EZ-Pass upload (optional) */}
        {step === 4 && (
          <>
            {uploadDone ? (
              <div className="alert alert-success" style={{ marginBottom: 16, fontSize: 14 }}>
                ✓ EZ-Pass statement uploaded successfully
              </div>
            ) : (
              <div className="card" style={{ marginBottom: 12 }}>
                <label className="upload-zone" style={{ cursor: uploading ? 'default' : 'pointer', padding: isMobile ? '1.5rem 1rem' : '2rem' }}>
                  <input type="file" multiple accept=".csv,.pdf,image/*" style={{ display: 'none' }}
                    onChange={e => handleTollUpload(e.target.files)} />
                  {uploading ? (
                    <><span className="spinner" style={{ margin: '0 auto 8px' }} />
                      <p className="upload-label">Parsing with AI...</p></>
                  ) : (
                    <>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>🛣️</div>
                      <p className="upload-label">{isMobile ? 'Tap to upload EZ-Pass files' : 'Drop files or click to browse'}</p>
                      <p className="upload-hint">PDF · CSV · Screenshots — multiple files OK</p>
                    </>
                  )}
                </label>
                {uploadError && <div className="alert alert-error" style={{ marginTop: 8 }}>{uploadError}</div>}
              </div>
            )}

            {!isMobile && (
              <>
                <button className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, marginBottom: 10 }}
                  disabled={finishing} onClick={finish}>
                  {finishing ? <><span className="spinner" /> Setting up...</> : 'Finish setup →'}
                </button>
                {!uploadDone && (
                  <button className="btn" style={{ width: '100%', justifyContent: 'center', color: '#888' }}
                    disabled={finishing} onClick={finish}>
                    Skip for now
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Mobile sticky footer ── */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '0.5px solid #e5e3de',
          padding: `12px 16px calc(12px + env(safe-area-inset-bottom, 0px))`,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {step === 1 && (
            <button className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 16, borderRadius: 12 }}
              disabled={subscribing} onClick={startSubscription}>
              {subscribing ? <><span className="spinner" /> Redirecting...</> : plan?.trial_days > 0 ? `Start ${plan.trial_days}-day free trial` : `Subscribe for $${((plan?.price_cents || 1000) / 100).toFixed(2)}/mo`}
            </button>
          )}
          {step === 2 && (
            <>
              {!scrolledTerms && (
                <p style={{ fontSize: 12, color: '#888', textAlign: 'center', margin: 0 }}>
                  Scroll through the terms above to continue
                </p>
              )}
              <button className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 16, borderRadius: 12 }}
                disabled={!agreedTerms} onClick={() => setStep(3)}>
                I agree — Continue →
              </button>
            </>
          )}
          {step === 3 && (
            <button className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 16, borderRadius: 12 }}
              disabled={saving} onClick={saveVehicles}>
              {saving ? <><span className="spinner" /> Saving...</> : 'Next →'}
            </button>
          )}
          {step === 4 && (
            <>
              <button className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 16, borderRadius: 12 }}
                disabled={finishing} onClick={finish}>
                {finishing ? <><span className="spinner" /> Setting up...</> : 'Finish setup →'}
              </button>
              {!uploadDone && (
                <button className="btn"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px', color: '#888' }}
                  disabled={finishing} onClick={finish}>
                  Skip for now
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
