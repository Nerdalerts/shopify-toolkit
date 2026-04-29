import React, { useState, useRef, useEffect } from 'react';
import { Mail, RefreshCw, Copy, Check, AlertCircle, ArrowRight, Sparkles, Send } from 'lucide-react';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // The execution environment provides the key at runtime

// --- API & Utility Functions ---

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(url, options, retries = 5) {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      
      // Explicitly catch server overload errors
      if (res.status === 503 || res.status === 429) {
        throw new Error(`Server busy: ${res.status}`);
      }
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
      
    } catch (e) {
      if (i === retries - 1) {
        // If it still fails after 5 tries, pass the error down
        throw new Error("The AI server is currently overloaded. Please try again in a minute.");
      }
      await delay(delays[i]);
    }
  }
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: {
      parts: [{ text: "You are an expert copywriter specializing in e-commerce and Shopify. Provide responses in plain text without markdown bolding (**)." }]
    }
  };
  
  const result = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

const copyToClipboard = (text, setCopied) => {
  // Using execCommand as requested for maximum compatibility in iframe environments
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    if (setCopied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }
  document.body.removeChild(textArea);
};

// --- Reusable UI Components ---

const Input = ({ label, id, value, onChange, placeholder, isTextarea = false }) => (
  <div className="flex flex-col gap-1.5 mb-4">
    <label htmlFor={id} className="text-sm font-semibold text-slate-700">
      {label}
    </label>
    {isTextarea ? (
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none min-h-[120px] resize-y text-slate-800"
      />
    ) : (
      <input
        type="text"
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-slate-800"
      />
    )}
  </div>
);

const CopyBtn = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => copyToClipboard(text, setCopied)}
      className="absolute top-3 right-3 p-2 rounded-lg bg-white/80 hover:bg-white shadow-sm border border-slate-100 text-slate-500 hover:text-indigo-600 transition-all flex items-center gap-1.5 text-xs font-medium backdrop-blur-sm"
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

const OutputCard = ({ label, content }) => {
  if (!content) return null;
  return (
    <div className="relative bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-xs font-bold uppercase tracking-wider text-indigo-500 mb-3">{label}</div>
      <div className="text-slate-700 whitespace-pre-wrap font-sans text-sm leading-relaxed pr-12">
        {content}
      </div>
      <CopyBtn text={content} />
    </div>
  );
};

// --- Main Application ---

export default function App() {
  const [activeTab, setActiveTab] = useState('email');
  const [error, setError] = useState('');
  
  // Email State
  const [emailForm, setEmailForm] = useState({
    store: '', niche: '', url: '', pain: '', product: '', tone: 'Casual'
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState({ subject: '', body: '' });

  // Repurpose State
  const [repurposeForm, setRepurposeForm] = useState({
    content: '', context: 'Targeting Shopify store owners'
  });
  const [repurposeLoading, setRepurposeLoading] = useState(false);
  const [repurposeResult, setRepurposeResult] = useState({
    reddit: '', subjects: '', tweet: '', linkedin: ''
  });

  const handleEmailChange = (e) => {
    setEmailForm({ ...emailForm, [e.target.id]: e.target.value });
  };

  const generateEmail = async () => {
    const { store, niche, pain, product, tone, url } = emailForm;
    if (!store || !niche || !pain || !product) {
      setError('Please fill in store name, niche, pain point and your product.');
      return;
    }
    
    setError('');
    setEmailLoading(true);
    setEmailResult({ subject: '', body: '' });

    const prompt = `Write a cold outreach email for a Shopify store.

Store: ${store} ${url ? `(${url})` : ''}
Niche: ${niche}
Pain point to address: ${pain}
Product/app being pitched: ${product}
Tone: ${tone}

Requirements:
- Subject line that gets opened (not generic)
- Email body: 4-6 short punchy paragraphs, no fluff
- Personalized to this specific store and niche
- Clear CTA at the end
- No corporate jargon

Reply ONLY in this exact format with NO markdown:
SUBJECT: [subject line here]
BODY:
[email body here]`;

    try {
      const text = await callGemini(prompt);
      // Clean potential bold markdown just in case
      const cleanText = text.replace(/\*\*/g, ''); 
      
      const subjectMatch = cleanText.match(/SUBJECT:\s*(.+)/i);
      const bodyMatch = cleanText.match(/BODY:\s*([\s\S]+)/i);
      
      setEmailResult({
        subject: subjectMatch ? subjectMatch[1].trim() : 'Subject Line',
        body: bodyMatch ? bodyMatch[1].trim() : cleanText
      });
    } catch (err) {
      setError('Failed to generate email. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const generateRepurpose = async () => {
    if (!repurposeForm.content) {
      setError('Please paste some content to repurpose.');
      return;
    }

    setError('');
    setRepurposeLoading(true);
    setRepurposeResult({ reddit: '', subjects: '', tweet: '', linkedin: '' });

    const prompt = `Repurpose the following content into 4 formats${repurposeForm.context ? ` for: ${repurposeForm.context}` : ''}.

CONTENT:
${repurposeForm.content}

Reply ONLY in this exact format with NO markdown bolding and NO extra commentary:

REDDIT:
[A helpful, non-salesy Reddit post that addresses the pain point naturally. 3-4 paragraphs. Fits r/shopify or r/ecommerce. End with a soft CTA.]

SUBJECTS:
[5 cold email subject line variations, one per line, numbered]

TWEET:
[A Twitter/X thread opening hook — one punchy tweet that stops the scroll, max 280 chars]

LINKEDIN:
[A LinkedIn post — insight-led, 4-5 short paragraphs, ends with a question to drive comments]`;

    try {
      const text = await callGemini(prompt);
      const cleanText = text.replace(/\*\*/g, '');

      const extractSection = (key) => {
        const regex = new RegExp(`${key}:\\s*([\\s\\S]+?)(?=\\n[A-Z]+:|$)`, 'i');
        const match = cleanText.match(regex);
        return match ? match[1].trim() : '';
      };

      setRepurposeResult({
        reddit: extractSection('REDDIT'),
        subjects: extractSection('SUBJECTS'),
        tweet: extractSection('TWEET'),
        linkedin: extractSection('LINKEDIN')
      });
    } catch (err) {
      setError('Failed to repurpose content. Please try again.');
    } finally {
      setRepurposeLoading(false);
    }
  };

  const jumpToRepurpose = () => {
    setRepurposeForm({ ...repurposeForm, content: emailResult.body });
    setActiveTab('repurpose');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const tones = ['Casual', 'Professional', 'Direct', 'Friendly'];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-sm mb-4 border border-indigo-50 text-indigo-500">
            <Sparkles size={32} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Shopify Outreach Toolkit
          </h1>
          <p className="text-slate-500">
            Cold email personalizer & content repurposer powered by Gemini
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          
          {/* Tabs */}
          <div className="flex p-2 bg-slate-50/80 border-b border-slate-100">
            <button
              onClick={() => { setActiveTab('email'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'email' 
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60' 
                  : 'text-slate-500 hover:bg-slate-100/50 hover:text-slate-700'
              }`}
            >
              <Mail size={18} /> Cold Email
            </button>
            <button
              onClick={() => { setActiveTab('repurpose'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'repurpose' 
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60' 
                  : 'text-slate-500 hover:bg-slate-100/50 hover:text-slate-700'
              }`}
            >
              <RefreshCw size={18} /> Repurpose Content
            </button>
          </div>

          <div className="p-6 md:p-8">
            
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-start gap-3 text-sm">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* TAB: EMAIL */}
            {activeTab === 'email' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                  <Input 
                    label="Store Name" id="store" 
                    placeholder="e.g. Glow Botanics"
                    value={emailForm.store} onChange={handleEmailChange} 
                  />
                  <Input 
                    label="Store Niche" id="niche" 
                    placeholder="e.g. Skincare, Apparel"
                    value={emailForm.niche} onChange={handleEmailChange} 
                  />
                </div>
                
                <Input 
                  label="Store URL (Optional)" id="url" 
                  placeholder="e.g. glowbotanics.com"
                  value={emailForm.url} onChange={handleEmailChange} 
                />
                
                <Input 
                  label="Pain Point You're Solving" id="pain" 
                  placeholder="e.g. high cart abandonment, low repeat purchases"
                  value={emailForm.pain} onChange={handleEmailChange} 
                />
                
                <Input 
                  label="Your Product / App" id="product" 
                  placeholder="e.g. Clickpost — Shopify post-purchase app"
                  value={emailForm.product} onChange={handleEmailChange} 
                />
                
                <div className="flex flex-col gap-2 mb-6">
                  <label className="text-sm font-semibold text-slate-700">Voice & Tone</label>
                  <div className="flex flex-wrap gap-2">
                    {tones.map(tone => (
                      <button
                        key={tone}
                        onClick={() => setEmailForm({ ...emailForm, tone })}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          emailForm.tone === tone
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                            : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generateEmail}
                  disabled={emailLoading}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  {emailLoading ? (
                    <><RefreshCw className="animate-spin" size={20} /> Writing your email...</>
                  ) : (
                    <><Send size={20} /> Generate Cold Email</>
                  )}
                </button>

                {/* Email Results */}
                {(emailResult.subject || emailResult.body) && !emailLoading && (
                  <div className="mt-8 space-y-4 pt-6 border-t border-slate-100 animate-in fade-in duration-500">
                    <OutputCard label="Subject Line" content={emailResult.subject} />
                    <OutputCard label="Email Body" content={emailResult.body} />
                    
                    <button
                      onClick={jumpToRepurpose}
                      className="w-full mt-2 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      Repurpose this email <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB: REPURPOSE */}
            {activeTab === 'repurpose' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Input
                  isTextarea
                  label="Content to Repurpose"
                  id="content"
                  placeholder="Paste any content here — cold email, article, landing page copy..."
                  value={repurposeForm.content}
                  onChange={(e) => setRepurposeForm({ ...repurposeForm, content: e.target.value })}
                />
                
                <Input
                  label="Context / Target Audience (Optional)"
                  id="context"
                  placeholder="e.g. targeting Shopify store owners, DTC brands"
                  value={repurposeForm.context}
                  onChange={(e) => setRepurposeForm({ ...repurposeForm, context: e.target.value })}
                />

                <button
                  onClick={generateRepurpose}
                  disabled={repurposeLoading}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  {repurposeLoading ? (
                    <><RefreshCw className="animate-spin" size={20} /> Repurposing content...</>
                  ) : (
                    <><Sparkles size={20} /> Repurpose Now</>
                  )}
                </button>

                {/* Repurpose Results */}
                {(repurposeResult.reddit || repurposeResult.tweet) && !repurposeLoading && (
                  <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
                    <OutputCard label="LinkedIn Post" content={repurposeResult.linkedin} />
                    <OutputCard label="Twitter / X Thread Hook" content={repurposeResult.tweet} />
                    <OutputCard label="Reddit Post" content={repurposeResult.reddit} />
                    <OutputCard label="Alternative Subject Lines" content={repurposeResult.subjects} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <p className="text-center text-slate-400 text-xs mt-6">
          shopify-toolkit by Adarsh.
        </p>
      </div>
    </div>
  );
}