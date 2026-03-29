import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  PenTool, SearchCode, ImageIcon, MessageSquare, 
  CheckCircle2, AlertTriangle, FileText, Send, Loader2, Copy, 
  Zap, Info, Upload, Plus, BrainCircuit, Terminal, Clock, 
  ChevronRight, Sparkles, ShieldCheck, ArrowRightLeft, Target, 
  Award, Play, Sun, Moon, Palette, Download, Check, RefreshCw, 
  Save, Code, Flame, Cpu, ShieldAlert, Timer, User, Link as LinkIcon, 
  Calendar, BarChart3, Activity, PieChart, Layers, Trash2, Eraser
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Configuration ---
const DEFAULT_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const DEFAULT_MODEL = "gemini-2.0-flash"; // Modern default
const FALLBACK_MODEL = "gemini-1.5-flash"; 
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8003";

const MODEL_OPTIONS = [
  { 
    group: "OpenAI (GPT)", 
    models: [
      { id: "gpt-5.4-nano", name: "GPT-5.4 Nano" },
      { id: "gpt-5.4-mini", name: "GPT-5.4 Mini" },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano" },
      { id: "gpt-4o-mini", name: "GPT-4o-mini" },
    ]
  },
  { 
    group: "Google (Gemini)", 
    models: [
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite" },
      { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    ]
  },
  { 
    group: "Ollama (Local / Free)", 
    models: [
      { id: "phi-4-mini", name: "Phi-4-mini" },
      { id: "llama-3.3", name: "Llama 3.3" },
      { id: "gemma-3", name: "Gemma 3" },
      { id: "qwen-3", name: "Qwen 3" },
      { id: "mistral-small-3", name: "Mistral Small 3" },
      { id: "deepseek-v3.2-exp", name: "DeepSeek V3.2-Exp" },
      { id: "deepseek-v3.2", name: "DeepSeek V3.2" },
      { id: "minimax-m2.1", name: "MiniMax M2.1" },
      { id: "devstral-2", name: "Devstral 2" },
    ]
  }
];

const THEMES = {
  purple: { primary: 'purple', color: '#a855f7', gradient: 'from-purple-600 via-fuchsia-600 to-indigo-600', ring: 'focus:ring-purple-500', text: 'text-purple-500', bg: 'bg-purple-600', glow: 'shadow-purple-500/20' },
  blue: { primary: 'blue', color: '#3b82f6', gradient: 'from-blue-600 to-cyan-500', ring: 'focus:ring-blue-500', text: 'text-blue-500', bg: 'bg-blue-600', glow: 'shadow-blue-500/20' },
  teal: { primary: 'teal', color: '#14b8a6', gradient: 'from-teal-500 to-emerald-600', ring: 'focus:ring-teal-500', text: 'text-teal-500', bg: 'bg-teal-600', glow: 'shadow-teal-500/20' },
};

// --- API Logic ---
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function callGemini(payload, currentApiKey, model = DEFAULT_MODEL, retries = 3) {
  if (!currentApiKey) throw new Error("API Key is missing. Please enter it in the configuration panel.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentApiKey}`;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.status === 429 || response.status >= 500) {
        await delay(Math.pow(2, i) * 1000);
        continue;
      }
      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      return await response.json();
    } catch (err) {
      if (i === retries - 1) {
        // Fallback for primary failures
        if (model === DEFAULT_MODEL && FALLBACK_MODEL) return callGemini(payload, currentApiKey, FALLBACK_MODEL, 3);
        throw err;
      }
      await delay(Math.pow(2, i) * 1000);
    }
  }
}

// --- Local PDF Processing ---
const loadPdfJs = () => {
  return new Promise((resolve) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    document.head.appendChild(script);
  });
};

const extractTextFromPdf = async (file) => {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(item => item.str).join(" ") + "\n";
  }
  return fullText;
};

// --- UI Components ---

const GlassCard = ({ children, title, icon: Icon, className = "", headerAction, darkMode, themeColor }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.98, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    whileHover={{ y: -4, boxShadow: darkMode ? `0 25px 50px -12px ${themeColor.color}20` : '0 25px 50px -12px rgba(0,0,0,0.1)' }}
    className={`backdrop-blur-3xl border relative overflow-hidden transition-all duration-500 rounded-[2.5rem] p-8 md:p-10 ${
      darkMode 
        ? 'bg-[#0F141A]/80 border-white/10 text-white shadow-2xl shadow-black/80' 
        : 'bg-white/90 border-slate-200 text-slate-900 shadow-2xl shadow-slate-200/60'
    } ${className}`}
  >
    {title && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/5">
        <div className="flex items-center space-x-4">
          {Icon && <div className={`p-4 rounded-3xl ${darkMode ? 'bg-white/5 border border-white/10' : 'bg-slate-100'}`} style={{ color: themeColor.color, boxShadow: `0 0 40px ${themeColor.color}30` }}><Icon size={24} /></div>}
          <h3 className="text-2xl font-black tracking-tight leading-none">{title}</h3>
        </div>
        {headerAction}
      </div>
    )}
    <div className="relative z-10 leading-relaxed space-y-4">
      {children}
    </div>
  </motion.div>
);

const CircularGauge = ({ value, label, color, size = 120 }) => {
  const radius = size * 0.4;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 10) * circumference;

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100 opacity-20" />
          <motion.circle 
            cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth="8" fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-black text-2xl">{value}</div>
      </div>
      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
    </div>
  );
};

const Badge = ({ children, variant = "default", darkMode }) => {
  const styles = {
    default: darkMode ? "bg-white/5 border-white/10 text-slate-400" : "bg-slate-100 text-slate-600 border-slate-200",
    success: darkMode ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 text-emerald-600 border-emerald-100",
    error: darkMode ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-rose-50 text-rose-600 border-rose-100",
    accent: darkMode ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-600 border-blue-100",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-widest flex items-center gap-2 ${styles[variant]}`}>
      {children}
    </span>
  );
};

const AnimatedButton = ({ children, onClick, loading, disabled, icon: Icon, variant = "primary", themeColor, darkMode, className = "" }) => (
  <button
    onClick={onClick}
    disabled={loading || disabled}
    className={`relative group px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center space-x-3 transition-all active:scale-95 disabled:opacity-50 overflow-hidden ${
      variant === "primary" 
        ? `bg-gradient-to-r ${themeColor.gradient} text-white shadow-lg ${themeColor.glow}` 
        : darkMode 
          ? "bg-white/5 text-white border border-white/10 hover:bg-white/10" 
          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
    } ${className}`}
  >
    {loading ? <Loader2 size={18} className="animate-spin" /> : Icon && <Icon size={18} />}
    <span className="relative z-10">{children}</span>
    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
  </button>
);

// --- Advanced Formatting Typewriter Component ---
const FormattedTypewriter = ({ text, speed = 12, themeColor, isAi, animate = true }) => {
  const [displayedText, setDisplayedText] = useState(animate ? "" : text);
  
  useEffect(() => {
    if (!animate || !text) {
      setDisplayedText(text || "");
      return;
    }
    let i = 0;
    setDisplayedText("");
    const timer = setInterval(() => {
      setDisplayedText(text.substring(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, animate]);

  const formatText = (raw) => {
    if (!isAi) return { __html: raw };
    // Parse Markdown dynamically for colorful and professional UI rendering
    let formatted = raw
      .replace(/^### (.*?)$/gm, `<h3 class="text-lg font-black ${themeColor.text} mt-6 mb-3 flex items-center gap-2 drop-shadow-sm border-b border-${themeColor.primary}-500/20 pb-2"><span class="text-xl">✨</span> $1</h3>`)
      .replace(/^## (.*?)$/gm, `<h2 class="text-xl font-black ${themeColor.text} mt-6 mb-3">$1</h2>`)
      .replace(/\*\*([^*]+)\*\*/g, `<strong class="${themeColor.text} font-black tracking-tight drop-shadow-sm">$1</strong>`)
      .replace(/^[-*] (.*?)$/gm, `<div class="ml-2 mb-2 flex items-start gap-3"><span class="${themeColor.text} font-black text-lg leading-none">→</span> <span class="leading-relaxed">$1</span></div>`);
      
    formatted = formatted.replace(/\n/g, '<br />');
    return { __html: formatted };
  };

  return <div className="leading-relaxed text-sm font-medium" dangerouslySetInnerHTML={formatText(displayedText)} />;
};


// --- Section Modules ---

const Task11_Copywriting = ({ darkMode, themeColor, state, setState, apiKey, model }) => {
  const [loading, setLoading] = useState(false);
  const { brief, results } = state;

  const generate = async () => {
    setLoading(true);
    try {
      const prompt = `Generate 3 ad copy variations (headline, tagline, body, cta). Format as JSON. Brief: ${brief}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "You are a professional ad copywriter. Output MUST be strictly JSON: { v1: { headline, tagline, body, cta }, v2, v3 }" }] },
        generationConfig: { responseMimeType: "application/json" }
      };
      const data = await callGemini(payload, apiKey, model);
      setState(p => ({ ...p, results: JSON.parse(data.candidates[0].content.parts[0].text) }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const clear = () => setState({ brief: '', results: null });

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
      <GlassCard title="Task 1.1 — AI Copywriting API" icon={PenTool} darkMode={darkMode} themeColor={themeColor}>
        <div className="space-y-6">
          <textarea 
            className={`w-full p-8 rounded-3xl border text-xl font-medium focus:ring-2 outline-none transition-all ${darkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200'} ${themeColor.ring}`}
            value={brief}
            onChange={(e) => setState(p => ({ ...p, brief: e.target.value }))}
            placeholder="Enter product brief..."
          />
          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <AnimatedButton onClick={generate} loading={loading} icon={Zap} themeColor={themeColor} darkMode={darkMode} className="flex-1">Generate Creative Variations</AnimatedButton>
            <AnimatedButton onClick={clear} variant="secondary" icon={Eraser} themeColor={themeColor} darkMode={darkMode}>Clear Hub</AnimatedButton>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {results && Object.entries(results).map(([key, v], i) => (
          <GlassCard key={key} darkMode={darkMode} themeColor={themeColor} className="hover:scale-[1.02] transition-transform cursor-pointer border-t-8" style={{ borderColor: themeColor.color }}>
            <div className="space-y-6">
              <Badge variant="accent" darkMode={darkMode}>AD OPTION {i + 1}</Badge>
              <div><span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Headline</span><h4 className="text-2xl font-black leading-tight">{v.headline}</h4></div>
              <div><span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Tagline</span><p className="text-lg italic font-medium opacity-80">"{v.tagline}"</p></div>
              <div><span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Body</span><p className="text-sm opacity-60 leading-relaxed">{v.body}</p></div>
              <div className={`p-4 rounded-2xl border text-center font-black text-xs uppercase tracking-widest ${themeColor.text} ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>{v.cta}</div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

const Task12_PromptChallenge = ({ darkMode, themeColor, state, setState, apiKey, model }) => {
  const [loading, setLoading] = useState(false);
  const { weakInput, result } = state;

  const improve = async () => {
    if (!weakInput) return;
    setLoading(true);
    try {
      const payload = {
        contents: [{ parts: [{ text: `Optimize this weak prompt: "${weakInput}"` }] }],
        systemInstruction: { parts: [{ text: "You are a Senior Prompt Architect. Rewrite the weak prompt into a high-performance refined version using Role Prompting, Few-Shot, and Chain-of-Thought. Return strictly JSON: { improved_prompt, techniques: string[], explanation, enhancement_metrics: { clarity_gain: number, structure_gain: number, creative_impact: number }, comparison: { weak_output, refined_output } }. Values for gains should be 1-100." }] },
        generationConfig: { responseMimeType: "application/json" }
      };
      const data = await callGemini(payload, apiKey, model);
      setState(p => ({ ...p, result: JSON.parse(data.candidates[0].content.parts[0].text) }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const clear = () => setState({ weakInput: '', result: null });

  const weakPrompts = [
    "Write a social media post for our new shoe brand.",
    "Make our ad copy more creative.",
    "Summarize this campaign brief."
  ];

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
      <GlassCard title="Task 1.2 — Advanced Prompt Lab" icon={BrainCircuit} darkMode={darkMode} themeColor={themeColor}>
        <div className="space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Input</span>
            <textarea 
              className={`w-full p-8 rounded-3xl border text-lg focus:ring-2 outline-none transition-all ${darkMode ? 'bg-rose-500/5 border-rose-500/20 text-rose-200' : 'bg-rose-50 border-rose-100 text-rose-800'}`}
              value={weakInput}
              onChange={(e) => setState(p => ({ ...p, weakInput: e.target.value }))}
              placeholder="Paste weak prompt here..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {weakPrompts.map((p, i) => <button key={i} onClick={() => setState(pr => ({ ...pr, weakInput: p }))} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${darkMode ? 'bg-white/5 border-white/10 hover:border-white/30' : 'bg-white border-slate-200 hover:border-slate-400'}`}>{p}</button>)}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <AnimatedButton onClick={improve} loading={loading} icon={RefreshCw} themeColor={themeColor} darkMode={darkMode} className="flex-1">Optimize Prompt Logic</AnimatedButton>
            <AnimatedButton onClick={clear} variant="secondary" icon={Eraser} themeColor={themeColor} darkMode={darkMode}>Clear Hub</AnimatedButton>
          </div>
        </div>
      </GlassCard>

      {result && (
        <div className="space-y-8 animate-in fade-in duration-700">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <GlassCard title="Refined Architecture" icon={Terminal} className="lg:col-span-2" darkMode={darkMode} themeColor={themeColor}>
              <div className={`p-6 rounded-2xl border font-mono text-xs leading-relaxed whitespace-pre-wrap ${darkMode ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                {result.improved_prompt}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {result.techniques.map((t, i) => <Badge key={i} variant="accent" darkMode={darkMode}>{t}</Badge>)}
              </div>
            </GlassCard>
            
            <GlassCard title="Enhancement Metrics" icon={Activity} darkMode={darkMode} themeColor={themeColor}>
               <div className="space-y-6 py-2">
                  {[
                    { label: 'Clarity Gain', val: result.enhancement_metrics.clarity_gain },
                    { label: 'Structure Logic', val: result.enhancement_metrics.structure_gain },
                    { label: 'Creative Impact', val: result.enhancement_metrics.creative_impact },
                  ].map((m, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase"><span>{m.label}</span><span>+{m.val}%</span></div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }} animate={{ width: `${m.val}%` }} 
                          className={`h-full ${themeColor.bg}`} 
                        />
                      </div>
                    </div>
                  ))}
               </div>
            </GlassCard>
          </div>

          <GlassCard title="Strategic Enhancement Explanation" icon={Info} darkMode={darkMode} themeColor={themeColor}>
            <FormattedTypewriter text={result.explanation} isAi={false} themeColor={themeColor} className="text-lg opacity-80 leading-relaxed font-medium italic" />
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="error" darkMode={darkMode}>Output: Original Prompt</Badge>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Low Performance</span>
              </div>
              <div className={`p-8 rounded-3xl border h-[400px] overflow-y-auto text-sm italic opacity-50 shadow-inner ${darkMode ? 'bg-black/30 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                {result.comparison.weak_output}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="success" darkMode={darkMode}>Output: Refined Prompt</Badge>
                <span className={`text-[10px] font-black uppercase tracking-widest ${themeColor.text}`}>Optimized Engineering</span>
              </div>
              <div className={`p-8 rounded-3xl border h-[400px] overflow-y-auto text-sm font-medium leading-relaxed shadow-2xl relative ${darkMode ? 'bg-white/5 border-emerald-500/20' : 'bg-white border-slate-200'}`}>
                <div className="absolute top-4 right-4"><Sparkles className={themeColor.text} size={20} /></div>
                {result.comparison.refined_output}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Task21_BriefAnalyzer = ({ darkMode, themeColor, state, setState, apiKey, model }) => {
  const [loading, setLoading] = useState(false);
  const { text, analysis } = state;

  const analyze = async () => {
    setLoading(true);
    try {
      const payload = {
        contents: [{ parts: [{ text }] }],
        systemInstruction: { parts: [{ text: "Analyze campaign brief. Return JSON: { audience, key_messages, tone, channels, risks }" }] },
        generationConfig: { responseMimeType: "application/json" }
      };
      const res = await callGemini(payload, apiKey, model);
      setState(p => ({ ...p, analysis: JSON.parse(res.candidates[0].content.parts[0].text) }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const upload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const extracted = await extractTextFromPdf(file);
      setState(p => ({ ...p, text: extracted }));
    }
  };

  const clear = () => setState({ text: '', analysis: null });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-6 duration-700">
      <GlassCard title="Campaign Ingestion" icon={FileText} darkMode={darkMode} themeColor={themeColor} className="lg:col-span-1" headerAction={<><input type="file" id="pdf-brief" className="hidden" accept=".pdf" onChange={upload} /><label htmlFor="pdf-brief" className="p-2 cursor-pointer hover:opacity-70 transition-opacity"><Upload size={20} /></label></>}>
        <textarea 
          className={`w-full min-h-[400px] p-6 rounded-3xl border text-sm leading-relaxed outline-none transition-all ${darkMode ? 'bg-black/30 border-white/10' : 'bg-slate-50 border-slate-200 shadow-inner'}`}
          value={text} onChange={(e) => setState(p => ({ ...p, text: e.target.value }))}
          placeholder="Paste brief text or upload PDF..."
        />
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <AnimatedButton onClick={analyze} loading={loading} icon={SearchCode} themeColor={themeColor} darkMode={darkMode} className="flex-1">Extract Strategic Insights</AnimatedButton>
          <AnimatedButton onClick={clear} variant="secondary" icon={Eraser} themeColor={themeColor} darkMode={darkMode}>Clear Hub</AnimatedButton>
        </div>
      </GlassCard>

      <div className="lg:col-span-2 space-y-6">
        {analysis ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <GlassCard title="Target Profile" icon={Target} darkMode={darkMode} themeColor={themeColor}>
                <p className="text-base font-medium opacity-80 mb-8 leading-loose tracking-wide">{analysis.audience}</p>
                <div className={`p-6 rounded-3xl border shadow-inner ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Tone Signature</span>
                  <p className={`text-2xl font-black ${themeColor.text}`}>{analysis.tone}</p>
                </div>
              </GlassCard>
              <GlassCard title="Risk Analysis" icon={ShieldAlert} darkMode={darkMode} themeColor={themeColor}>
                <div className="space-y-4">
                  {analysis.risks.map((r, i) => <div key={i} className={`flex items-start gap-4 p-5 rounded-3xl border text-sm font-medium leading-relaxed ${darkMode ? 'bg-rose-500/5 border-rose-500/20 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.05)]' : 'bg-rose-50 border-rose-100 text-rose-800'}`}><AlertTriangle size={20} className="text-rose-500 shrink-0 mt-0.5" /><span>{r}</span></div>)}
                </div>
              </GlassCard>
            </div>
            <GlassCard title="Execution Logistics" icon={Cpu} darkMode={darkMode} themeColor={themeColor}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div><span className="text-xs font-black uppercase text-slate-400 block mb-6 tracking-widest">Key Messages</span><div className="space-y-4">{analysis.key_messages.map((m, i) => <div key={i} className="flex items-start gap-4 text-base font-medium opacity-80 leading-relaxed"><CheckCircle2 size={24} className="text-emerald-500 shrink-0 shadow-sm" /><span>{m}</span></div>)}</div></div>
                <div><span className="text-xs font-black uppercase text-slate-400 block mb-6 tracking-widest">Priority Channels</span><div className="flex flex-wrap gap-3">{analysis.channels.map((c, i) => <Badge key={i} variant="accent" darkMode={darkMode}>{c}</Badge>)}</div></div>
              </div>
            </GlassCard>
          </div>
        ) : <div className="h-full border-4 border-dashed rounded-3xl flex flex-col items-center justify-center p-20 opacity-30 italic"><SearchCode size={64} className="mb-4" /><p>Awaiting strategic ingestion...</p></div>}
      </div>
    </div>
  );
};

const Task22_VisionAudit = ({ darkMode, themeColor, state, setState, apiKey, model }) => {
  const [loading, setLoading] = useState(false);
  const { preview, data } = state;

  const upload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setState(p => ({ ...p, preview: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  // Normalize safety: handle both number and object responses from Gemini
  const normalizeSafetyScore = (safety) => {
    if (typeof safety === 'number') return Math.min(10, Math.max(0, safety));
    if (typeof safety === 'object' && safety !== null) {
      // Convert object like {violence: 0, hate: 0, sexual: 0, ...} to a 1-10 score
      // Low values on risk categories = high safety score
      const values = Object.values(safety).filter(v => typeof v === 'number');
      if (values.length === 0) return 7;
      const avgRisk = values.reduce((a, b) => a + b, 0) / values.length;
      // avgRisk 0=safe(10), 1=unsafe(1)
      return Math.round(10 - avgRisk * 9);
    }
    return 7; // default safe
  };

  const process = async () => {
    setLoading(true);
    try {
      const base64 = preview.split(',')[1];
      const payload = {
        contents: [{ parts: [
          { text: "Analyze this image for brand safety and content classification. Return ONLY a JSON object with these exact keys: { \"alt\": string (alt text description), \"tags\": string[] (content tags), \"safety\": number (brand safety score 1-10, where 10 is perfectly safe), \"cases\": string[] (ideal use cases) }. The safety field MUST be a single number between 1 and 10, not an object." },
          { inlineData: { mimeType: "image/png", data: base64 } }
        ]} ],
        generationConfig: { responseMimeType: "application/json" }
      };
      const res = await callGemini(payload, apiKey, model);
      const parsed = JSON.parse(res.candidates[0].content.parts[0].text);
      // Normalize safety to always be a number
      parsed.safety = normalizeSafetyScore(parsed.safety);
      setState(p => ({ ...p, data: parsed }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const clear = () => setState({ preview: null, data: null });

  return (
    <GlassCard title="Task 2.2 — Vision Safety & Tagging" icon={ImageIcon} darkMode={darkMode} themeColor={themeColor}>
      <div className="flex flex-col lg:flex-row gap-12">
        <div className="lg:w-1/3">
          <div className={`aspect-square rounded-3xl border-4 border-dashed flex flex-col items-center justify-center relative overflow-hidden group transition-all ${preview ? 'border-emerald-500' : 'border-slate-200'}`}>
            {preview ? <img src={preview} className="w-full h-full object-cover" /> : <div className="text-center p-8 opacity-20"><Upload size={48} className="mx-auto mb-2"/><p className="font-bold text-xs uppercase">Drop Visual Asset</p><input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={upload} /></div>}
            {preview && <button onClick={clear} className="absolute top-4 right-4 p-2 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <AnimatedButton onClick={process} loading={loading} icon={Zap} themeColor={themeColor} darkMode={darkMode} className="flex-1">Audit Visual Data</AnimatedButton>
            <AnimatedButton onClick={clear} variant="secondary" icon={Eraser} themeColor={themeColor} darkMode={darkMode}>Clear Hub</AnimatedButton>
          </div>
        </div>
        <div className="flex-1">
          {data ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex items-center gap-10">
                <CircularGauge value={data.safety} label="Brand Safety" color={data.safety > 7 ? '#10b981' : '#f43f5e'} size={140} />
                <div className="flex-1 space-y-4">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Alt Text Specification</span>
                  <p className="text-sm italic opacity-70 leading-relaxed bg-slate-500/5 p-4 rounded-xl border border-slate-500/10">"{data.alt}"</p>
                </div>
              </div>
              <div><span className="text-[10px] font-black uppercase text-slate-400 block mb-3">Content Classifiers</span><div className="flex flex-wrap gap-2">{data.tags.map((t, i) => <Badge key={i} darkMode={darkMode}>#{t}</Badge>)}</div></div>
              <div><span className="text-[10px] font-black uppercase text-slate-400 block mb-3">Ideal Use Cases</span><div className="grid grid-cols-2 gap-3">{data.cases.map((c, i) => <div key={i} className="p-3 rounded-xl border border-slate-500/10 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-500" />{c}</div>)}</div></div>
            </div>
          ) : <div className="h-full flex flex-col items-center justify-center opacity-20 italic py-20"><ImageIcon size={64} className="mb-4"/><p>Upload an asset to trigger computer vision audit.</p></div>}
        </div>
      </div>
    </GlassCard>
  );
};

const Task23_RAGBot = ({ darkMode, themeColor, state, setState }) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { messages, input, sources } = state;
  const chatContainerRef = useRef(null);

  // Scroll helper
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Scroll when new messages arrive or loading changes
  useEffect(() => {
    requestAnimationFrame(scrollToBottom);
  }, [messages, loading]);

  // MutationObserver: scroll on EVERY DOM change inside the chat container
  // This catches the typewriter typing characters one-by-one
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const observer = new MutationObserver(() => {
      container.scrollTop = container.scrollHeight;
    });
    observer.observe(container, {
      childList: true,   // new message bubbles added
      subtree: true,     // watch all descendants
      characterData: true // text node changes (typewriter chars)
    });
    return () => observer.disconnect();
  }, []);

  // Dynamic placeholder based on context
  const getPlaceholder = () => {
    if (loading) return 'Agent is thinking...';
    if (sources.length > 0) return `Ask about ${sources.map(s => s.name).join(', ')}...`;
    return 'Upload a PDF or ask a general question...';
  };

  const onUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BACKEND_URL}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      
      setState(p => ({ 
        ...p, 
        sources: [...p.sources, { name: file.name, text: data.message }],
        messages: [...p.messages, { role: 'ai', text: `Document "${file.name}" successfully chunked, embedded via OpenAI, and ingested into FAISS memory. I am ready for grounded queries.` }]
      }));
    } catch (err) { 
      console.error(err);
      setState(p => ({ ...p, messages: [...p.messages, { role: 'ai', text: `Error ingesting document: ${err.message}` }] }));
    }
    finally { setUploading(false); }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setState(p => ({ ...p, input: '', messages: [...p.messages, { role: 'user', text: msg }] }));
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Chat failed');
      
      setState(p => ({ ...p, messages: [...p.messages, { role: 'ai', text: data.answer }] }));
    } catch (e) { 
      console.error(e);
      setState(p => ({ ...p, messages: [...p.messages, { role: 'ai', text: 'Error connecting to the OpenAI Agent SDK backend. Check the Python server logs for details.' }] }));
    }
    finally { setLoading(false); }
  };

  const clear = () => setState({
    messages: [{ role: 'ai', text: 'I am the campaign intelligence core. Ingest PDFs to begin document-grounded reasoning.' }],
    input: '',
    sources: []
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[700px] animate-in slide-in-from-bottom-6 duration-700">
      <GlassCard title="Source Node" icon={Layers} darkMode={darkMode} themeColor={themeColor} className="lg:col-span-1 h-full flex flex-col">
        <input type="file" id="rag-up" className="hidden" accept=".pdf" onChange={onUpload} />
        <label htmlFor="rag-up" className={`w-full py-4 rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 cursor-pointer transition-all mb-6 ${darkMode ? 'border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5' : 'border-slate-200 hover:border-blue-500/50 hover:bg-blue-50'}`}>
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          <span className="text-xs font-black uppercase">Ingest PDF Node</span>
        </label>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {sources.map((s, i) => <div key={i} className={`p-4 rounded-2xl border flex items-center gap-3 ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}><FileText size={18} className={themeColor.text} /><span className="text-[10px] font-bold truncate">{s.name}</span></div>)}
        </div>
      </GlassCard>

      {/* Chat panel — inline motion.div so p-0 actually works (GlassCard hardcodes p-8 which overrides className) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`lg:col-span-3 h-full flex flex-col rounded-[2.5rem] overflow-hidden border backdrop-blur-3xl shadow-2xl ${
          darkMode
            ? 'bg-[#0F141A]/80 border-white/10 text-white shadow-black/80'
            : 'bg-white/90 border-slate-200 text-slate-900 shadow-slate-200/60'
        }`}
      >
        {/* Header — flex-shrink-0 so it never collapses */}
        <div className={`px-7 py-4 border-b flex items-center justify-between flex-shrink-0 ${
          darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg text-white ${themeColor.bg}`}><MessageSquare size={16} /></div>
            <span className="font-black text-xs uppercase tracking-widest">Campaign RAG Core</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={sources.length ? 'success' : 'default'} darkMode={darkMode}>
              {sources.length ? 'Grounded' : 'Global Knowledge'}
            </Badge>
            <button onClick={clear} className="px-3 py-2 hover:bg-rose-500/10 text-rose-500 rounded-xl transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border border-transparent hover:border-rose-500/20">
              <Eraser size={14}/> Clear
            </button>
          </div>
        </div>

        {/* Messages area — flex-1 so it fills all remaining space */}
        <div
          ref={chatContainerRef}
          className={`flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar ${
            darkMode ? 'bg-black/10' : 'bg-slate-50/60'
          }`}
        >
          {messages.map((m, i) => (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-5 rounded-3xl shadow-md ${
                m.role === 'user'
                  ? `${themeColor.bg} text-white rounded-br-none`
                  : darkMode
                    ? 'bg-white/5 border border-white/10 text-slate-200 rounded-bl-none'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
              }`}>
                {m.role === 'ai'
                  ? <FormattedTypewriter text={m.text} themeColor={themeColor} isAi={true} animate={i === messages.length - 1} />
                  : <div className="text-sm whitespace-pre-wrap font-medium">{m.text}</div>
                }
              </div>
            </motion.div>
          ))}
          {loading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
              <div className={`px-5 py-4 rounded-3xl rounded-bl-none flex gap-2 items-center ${
                darkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-sm'
              }`}>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                <span className="text-xs text-slate-400 font-medium ml-2">Agent thinking...</span>
              </div>
            </motion.div>
          )}
          {/* Invisible anchor at end */}
          <div className="h-1" />
        </div>

        {/* Input form — flex-shrink-0 so it always stays at bottom */}
        <form
          onSubmit={send}
          className={`flex-shrink-0 px-6 py-4 border-t ${
            darkMode ? 'bg-black/30 border-white/5' : 'bg-white border-slate-200'
          }`}
        >
          <div className="relative flex items-center">
            <input
              type="text"
              className={`w-full py-4 pl-6 pr-14 rounded-2xl border text-sm outline-none transition-all ${
                darkMode ? 'bg-black/30 border-white/10 placeholder-slate-600 text-white' : 'bg-slate-50 border-slate-200 placeholder-slate-400'
              } ${themeColor.ring}`}
              placeholder={getPlaceholder()}
              value={input}
              onChange={(e) => setState(p => ({ ...p, input: e.target.value }))}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className={`absolute right-2 p-3 rounded-xl text-white shadow-md transition-all disabled:opacity-30 active:scale-95 ${themeColor.bg}`}
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const Section3_Practical = ({ darkMode, themeColor, state, setState }) => {
  const [active, setActive] = useState(0);
  const { codes } = state;

  const q = [
    { id: 'Q1', title: 'Anthropic Retry Node', time: '15m', stack: 'Python', desc: 'Implement a function that retries up to 3 times on 429 errors using exponential backoff.' },
    { id: 'Q2', title: 'RAG Pipe Debugging', time: '20m', stack: 'LangChain', desc: 'Identify three logic errors in the vector retrieval chain leading to context dilution.' },
    { id: 'Q3', title: 'Tone Enforcer', time: '15m', stack: 'Prompt Eng', desc: 'Construct a System Prompt that dynamically checks if input copy violates brand safety guidelines.' },
    { id: 'Q4', title: 'Asset Risk Audit', time: '10m', stack: 'Vision', desc: 'Evaluate a batch of AI-generated visuals for visual artifacts and brand alignment risks.' },
    { id: 'Q5', title: 'Personalization Engine', time: '20m', stack: 'System Design', desc: 'Sketch an architecture for a real-time ad recommendation system handling 100k req/min.' },
  ];

  const clear = () => setState(p => ({ codes: { ...p.codes, [active]: '' } }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-1 space-y-3">
        {q.map((item, i) => (
          <button key={i} onClick={() => setActive(i)} className={`w-full p-6 rounded-3xl border transition-all text-left group relative overflow-hidden ${active === i ? `${themeColor.bg} text-white shadow-xl` : `${darkMode ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 shadow-sm'}`}`}>
            <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-black uppercase opacity-60">{item.id}</span><div className="flex items-center gap-1 text-[10px] font-black"><Clock size={10} />{item.time}</div></div>
            <h4 className="font-black text-sm">{item.title}</h4>
            {active === i && <motion.div layoutId="practical" className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/40" />}
          </button>
        ))}
      </div>
      <div className="lg:col-span-3">
        <GlassCard title={q[active].title} icon={Code} darkMode={darkMode} themeColor={themeColor}>
          <div className="space-y-8">
            <div className={`p-6 rounded-3xl border ${darkMode ? 'bg-black/20 border-white/10' : 'bg-slate-50 border-slate-200 shadow-inner'}`}><p className="text-lg opacity-80 leading-relaxed font-medium">{q[active].desc}</p></div>
            <div className="space-y-4">
              <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Technical Sandbox</span><Badge darkMode={darkMode}>{q[active].stack}</Badge></div>
              <textarea 
                className={`w-full p-8 rounded-[2rem] border font-mono text-sm min-h-[400px] outline-none transition-all ${darkMode ? 'bg-[#050505] border-white/10 text-emerald-400 focus:border-emerald-500/50' : 'bg-slate-900 border-slate-800 text-emerald-400 focus:ring-2'}`} 
                placeholder="# Architect solution here..." 
                value={codes[active] || ''}
                onChange={(e) => setState(p => ({ codes: { ...p.codes, [active]: e.target.value } }))}
              />
            </div>
            <div className="flex justify-end items-center pt-6 border-t border-slate-500/10">
              <div className="flex items-center gap-4">
                <AnimatedButton variant="secondary" onClick={clear} icon={Eraser} themeColor={themeColor} darkMode={darkMode}>Clear Sandbox</AnimatedButton>
                <AnimatedButton icon={Check} themeColor={themeColor} darkMode={darkMode}>Commit Code</AnimatedButton>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

// --- App Shell ---

const App = () => {
  const [active, setActive] = useState('t1.1');
  const [darkMode, setDarkMode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('purple');
  const [userApiKey, setUserApiKey] = useState(DEFAULT_API_KEY);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const themeColor = THEMES[currentTheme];

  // Lifted Global State Objects
  const [t11State, setT11State] = useState({ brief: 'New luxury perfume for men, brand name Noir, target audience 30-45 year old professionals.', results: null });
  const [t12State, setT12State] = useState({ weakInput: '', result: null });
  const [t21State, setT21State] = useState({ text: '', analysis: null });
  const [t22State, setT22State] = useState({ preview: null, data: null });
  const [t23State, setT23State] = useState({ messages: [{ role: 'ai', text: 'I am the campaign intelligence core. Ingest PDFs to begin document-grounded reasoning.' }], input: '', sources: [] });
  const [s3State, setS3State] = useState({ codes: {} });

  const candidateInfo = {
    name: "SHAHAN NAFEES",
    date: new Date().toLocaleDateString(),
    portfolio: "github.com/shahan-nafees",
    assessor: "AI DIV DIRECTOR"
  };

  const menu = [
    { id: 't1.1', label: '1.1 — Copywriting API', icon: PenTool },
    { id: 't1.2', label: '1.2 — Prompt Lab', icon: BrainCircuit },
    { id: 't2.1', label: '2.1 — Brief Analyzer', icon: SearchCode },
    { id: 't2.2', label: '2.2 — Vision Audit', icon: ImageIcon },
    { id: 't2.3', label: '2.3 — RAG Bot', icon: MessageSquare },
    { id: 's3', label: '3.0 — Practical Tasks', icon: Flame },
  ];

  return (
    <div className={`min-h-screen font-inter flex transition-colors duration-500 overflow-hidden ${darkMode ? 'bg-[#0F141A] text-white' : 'bg-[#FAFBFE] text-slate-800'}`}>
      
      {/* Animated Background Mesh */}
      <div className="fixed inset-0 pointer-events-none opacity-20 transition-opacity duration-1000">
        <div className={`absolute top-0 right-0 w-[1000px] h-[1000px] blur-[200px] rounded-full translate-x-1/2 -translate-y-1/2 ${themeColor.bg}`} />
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] blur-[150px] rounded-full -translate-x-1/2 translate-y-1/2 bg-blue-500/20" />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" 
          />
        )}
      </AnimatePresence>

      {/* Sidebar — Slide over on mobile, fixed on desktop */}
      <aside className={`fixed lg:relative z-50 h-full w-80 border-r transition-all duration-500 transform ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } ${darkMode ? 'bg-black border-white/5' : 'bg-white border-slate-200'}`}>
        <div className="h-full flex flex-col p-8 lg:p-10">
          <div className="flex items-center justify-between mb-14">
            <div className="flex items-center space-x-4">
              <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center text-white shadow-2xl ${themeColor.bg} ${themeColor.glow}`}><Zap size={28} /></div>
              <div className="flex flex-col">
                <span className={`font-black text-xl lg:text-2xl tracking-tighter leading-none ${darkMode ? 'text-white' : 'text-slate-900'}`}>SHAHAN<span className={themeColor.text}>LAB</span></span>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1.5">AI Assessment</span>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-black/5 rounded-xl"><Trash2 size={24} className="text-slate-400 rotate-45" /></button>
          </div>

          <nav className="flex-1 space-y-2 lg:space-y-3 overflow-y-auto pr-2 custom-scrollbar">
            {menu.map((item) => (
              <button 
                key={item.id} 
                onClick={() => { setActive(item.id); setIsSidebarOpen(false); }} 
                className={`w-full flex items-center space-x-4 lg:space-x-5 px-5 lg:px-6 py-3 lg:py-4 rounded-xl lg:rounded-2xl transition-all group relative overflow-hidden ${active === item.id ? `${themeColor.bg} text-white shadow-xl ${themeColor.glow}` : darkMode ? 'text-slate-500 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
              >
                <item.icon size={18} className="shrink-0" />
                <span className="font-black text-[10px] lg:text-[11px] uppercase tracking-widest">{item.label}</span>
                {active === item.id && <ChevronRight size={14} className="ml-auto opacity-50" />}
              </button>
            ))}
          </nav>

          <div className="pt-8 border-t border-slate-200/50 space-y-6">
            {/* AI Engine Settings */}
            <div className="px-2 space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">API Engine</span>
                <div className={`relative flex items-center p-1 rounded-xl border ${darkMode ? 'bg-black/40 border-white/10 text-emerald-400' : 'bg-slate-50 border-slate-200 text-slate-700 shadow-inner'}`}>
                  <input type="password" value={userApiKey} onChange={(e) => setUserApiKey(e.target.value)} className="w-full bg-transparent p-2 text-xs outline-none font-mono" placeholder="Gemini API Key..." />
                </div>
              </div>
              <div className={`relative p-1 rounded-xl border ${darkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-700 shadow-inner'}`}>
                <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="w-full bg-transparent p-2 text-[10px] uppercase font-black tracking-widest outline-none cursor-pointer">
                  {MODEL_OPTIONS.map(group => (
                    <optgroup key={group.group} label={group.group} className={darkMode ? 'bg-slate-900' : 'bg-white'}>
                      {group.models.map(m => <option key={m.id} value={m.id} className={darkMode ? 'bg-slate-900' : 'bg-white'}>{m.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between px-2">
              <button onClick={() => setDarkMode(!darkMode)} className={`p-4 rounded-[1.5rem] border transition-all ${darkMode ? 'bg-white/10 border-white/10 text-amber-400' : 'bg-white border-slate-200 text-slate-700 shadow-md'}`}>
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <div className="flex space-x-2">
                {Object.keys(THEMES).map(t => (
                  <button key={t} onClick={() => setCurrentTheme(t)} className={`w-6 h-6 rounded-full border-4 transition-all ${currentTheme === t ? 'scale-110 border-white shadow-lg' : 'opacity-20 border-transparent'} ${THEMES[t].bg}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 h-screen overflow-y-auto scroll-smooth p-6 lg:p-16 custom-scrollbar relative z-10 pt-24 lg:pt-16">
        
        {/* Mobile Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className={`fixed top-6 left-6 z-40 p-3 rounded-2xl border lg:hidden shadow-xl transition-all active:scale-95 ${
            darkMode ? 'bg-black/80 border-white/10 text-white backdrop-blur-md' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <BrainCircuit size={24} />
        </button>

        <header className="mb-14 lg:mb-20 flex flex-col lg:flex-row lg:items-end justify-between gap-10 lg:gap-12 animate-in fade-in slide-in-from-top-10 duration-1000">
          <div>
            <div className="flex items-center space-x-3 mb-6 flex-wrap gap-y-2">
              <Badge variant="accent" darkMode={darkMode}>Active Core Session</Badge>
              <Badge variant="success" darkMode={darkMode}>Direct Link: Mobile-Native</Badge>
            </div>
            <h1 className={`text-4xl lg:text-7xl font-black tracking-tighter leading-none ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              Engineer <span className={themeColor.text}>Shahan Lab</span>
            </h1>
            <p className="text-slate-500 text-lg lg:text-2xl mt-4 lg:mt-6 font-medium max-w-3xl leading-relaxed">AI Advertising Engineering Skills Assessment Platform</p>
          </div>

          <GlassCard darkMode={darkMode} themeColor={themeColor} className="p-6 lg:p-8 min-w-full lg:min-w-[400px]">
            <div className="grid grid-cols-2 gap-6 lg:gap-10">
              <div className="space-y-1.5">
                <span className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest block">Candidate</span>
                <div className="flex items-center space-x-2 lg:space-x-3 font-black text-xs lg:text-base uppercase">
                  <User size={14} className={themeColor.text} />
                  <span>{candidateInfo.name}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest block">Date</span>
                <div className="flex items-center space-x-2 lg:space-x-3 font-black text-xs lg:text-base">
                  <Calendar size={14} className={themeColor.text} />
                  <span>{candidateInfo.date}</span>
                </div>
              </div>
            </div>
            <div className="mt-6 lg:mt-8 pt-6 lg:pt-8 border-t border-slate-200/50 flex justify-between gap-6 lg:gap-8 text-center">
              <div><div className="text-xl lg:text-2xl font-black">4 Hours</div><div className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest">Duration</div></div>
              <div><div className="text-xl lg:text-2xl font-black">100</div><div className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest">Pts Max</div></div>
              <div><div className={`text-xl lg:text-2xl font-black ${themeColor.text}`}>70</div><div className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest">Pass Mark</div></div>
            </div>
          </GlassCard>
        </header>

        <div className="max-w-[1400px] mx-auto pb-40 px-1">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.4 }}>
              {active === 't1.1' && <Task11_Copywriting darkMode={darkMode} themeColor={themeColor} state={t11State} setState={setT11State} apiKey={userApiKey} model={selectedModel} />}
              {active === 't1.2' && <Task12_PromptChallenge darkMode={darkMode} themeColor={themeColor} state={t12State} setState={setT12State} apiKey={userApiKey} model={selectedModel} />}
              {active === 't2.1' && <Task21_BriefAnalyzer darkMode={darkMode} themeColor={themeColor} state={t21State} setState={setT21State} apiKey={userApiKey} model={selectedModel} />}
              {active === 't2.2' && <Task22_VisionAudit darkMode={darkMode} themeColor={themeColor} state={t22State} setState={setT22State} apiKey={userApiKey} model={selectedModel} />}
              {active === 't2.3' && <Task23_RAGBot darkMode={darkMode} themeColor={themeColor} state={t23State} setState={setT23State} />}
              {active === 's3' && <Section3_Practical darkMode={darkMode} themeColor={themeColor} state={s3State} setState={setS3State} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default App;