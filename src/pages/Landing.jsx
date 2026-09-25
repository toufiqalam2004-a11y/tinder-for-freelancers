import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  Flame,
  Sparkles,
  Zap,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Layers,
  Bot,
  Send,
  Heart,
  X,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Star,
  Globe,
  Play,
  Briefcase,
  Code,
  PenTool,
  Video,
  TrendingUp,
  Menu,
  Check,
  Clock,
  DollarSign,
  Search,
  ExternalLink,
  Lock,
  Youtube,
  Download,
  Smartphone,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { APK_CONFIG } from '../config/apkConfig';

// -------------------------------------------------------------
// Interactive Persona Data for Section 3
// -------------------------------------------------------------
const PERSONA_DATA = {
  video: {
    id: 'video',
    name: 'Video Editors',
    icon: Video,
    headline: 'High-Paying Creator & YouTube Editing Contracts',
    description:
      'Cut through low-ball gigs. Our AI Agent identifies high-growth creators, media agencies, and fintech channels actively recruiting long-term video editors.',
    avgRate: '$35 - $85 / hr',
    popularSources: ['r/CreatorServices', 'r/forhire', 'Twitter #editorhiring'],
    sampleJob: {
      title: 'Lead YouTube Video Editor — Tech & Finance Channel (800k subs)',
      budget: '$2,800 - $3,500 / mo retainer',
      type: 'Long-term Retainer',
      source: 'Reddit r/CreatorServices',
      time: '14m ago',
      matchScore: 99,
      tags: ['Premiere Pro', 'After Effects', 'Storytelling', 'Sound Design'],
      snippet:
        'Looking for a top-tier pacing specialist who understands YouTube retention curves and motion graphics. 2 videos per week, fast turnaround.',
    },
  },
  design: {
    id: 'design',
    name: 'UI/UX Designers',
    icon: PenTool,
    headline: 'Land High-Intent Web & SaaS Product Redesigns',
    description:
      'Stop pitching into 100-bid design contests. Discover founders who just raised seed rounds and need rapid UI/UX sprints, design systems, and Figma tokens.',
    avgRate: '$50 - $120 / hr',
    popularSources: ['r/designjobs', 'Twitter #designhiring', 'Dribbble Remote'],
    sampleJob: {
      title: 'Senior UI/UX Designer — AI Workflow Tool Web & Mobile App',
      budget: '$4,500 fixed sprint',
      type: 'Contract / Fixed',
      source: 'Twitter Founder Feed',
      time: '8m ago',
      matchScore: 97,
      tags: ['Figma', 'Design Systems', 'SaaS', 'Mobile UX'],
      snippet:
        'Series A funded AI startup needs an end-to-end design refresh of our primary user dashboard. Must have experience with dark-mode SaaS interfaces.',
    },
  },
  dev: {
    id: 'dev',
    name: 'Developers & Engineers',
    icon: Code,
    headline: 'Direct Founder Outreach for Full-Stack & API Builds',
    description:
      'Skip the recruiter spam. Connect directly with technical CTOs and indie hackers hiring for React, Node, Python, and smart contract development.',
    avgRate: '$60 - $140 / hr',
    popularSources: ['r/Jobbit', 'r/forhire', 'Hacker News Who is Hiring'],
    sampleJob: {
      title: 'Full-Stack Next.js & FastAPI Engineer — Stripe & LLM Integration',
      budget: '$6,000 / mo or $75/hr',
      type: 'Part-Time Contract',
      source: 'Reddit r/Jobbit',
      time: '22m ago',
      matchScore: 98,
      tags: ['Next.js', 'React', 'FastAPI', 'PostgreSQL', 'Tailwind'],
      snippet:
        'Building a fast-growing B2B analytics platform. Need a reliable engineer to build customer-facing reports and integrate OpenAI streaming APIs.',
    },
  },
  writing: {
    id: 'writing',
    name: 'Writers & Copywriters',
    icon: Briefcase,
    headline: 'High-Ticket Ghostwriting & B2B SEO Content',
    description:
      'No $5 content mill junk. Match with marketing directors and founders ready to invest in authority LinkedIn ghostwriting, newsletters, and conversion copy.',
    avgRate: '$40 - $90 / hr',
    popularSources: ['r/HireaWriter', 'LinkedIn Hiring', 'Twitter #freelancewriter'],
    sampleJob: {
      title: 'B2B SaaS Ghostwriter & Weekly Tech Newsletter Author',
      budget: '$400 - $600 per edition',
      type: 'Recurring Weekly',
      source: 'Reddit r/HireaWriter',
      time: '35m ago',
      matchScore: 96,
      tags: ['Ghostwriting', 'B2B Copy', 'Substack', 'SaaS Positioning'],
      snippet:
        'Seeking an experienced writer to produce a deep-dive weekly newsletter on developer tools. Must write with strong punchy opinions and technical clarity.',
    },
  },
  growth: {
    id: 'growth',
    name: 'Growth & Marketers',
    icon: TrendingUp,
    headline: 'High-ROI Performance Marketing & Growth Gigs',
    description:
      'Match with DTC brands and early-stage startups actively seeking paid acquisition, funnel optimization, and organic distribution architects.',
    avgRate: '$45 - $110 / hr',
    popularSources: ['Public Facebook Ad Groups', 'Twitter #marketingjobs'],
    sampleJob: {
      title: 'Meta & TikTok Paid Acquisition Growth Lead — E-Commerce DTC',
      budget: '$3,000 / mo + Performance Bonus',
      type: 'Monthly Retainer',
      source: 'Public Marketing Community',
      time: '19m ago',
      matchScore: 95,
      tags: ['Meta Ads', 'TikTok Ads', 'ROAS Optimization', 'Creative Strategy'],
      snippet:
        'Scaling from $40k to $150k monthly ad spend. Need a proven media buyer who can craft angles, test UGC hooks, and manage scaling budgets.',
    },
  },
};

// -------------------------------------------------------------
// Interactive Swipe Deck Sample Data for Section 6 (5 Personas)
// -------------------------------------------------------------
const DEMO_CARDS = [
  {
    id: 'demo-1',
    roleCategory: 'Video Editing',
    title: 'Lead YouTube & Short-Form Video Editor — FinTech Channel (800k subs)',
    client: 'Apex Capital Media',
    budget: '$3,200 / mo retainer',
    timeline: 'Ongoing Retainer',
    source: 'Reddit r/CreatorServices',
    postedTime: '12m ago',
    matchScore: 99,
    tags: ['Premiere Pro', 'After Effects', 'Sound Design', 'YouTube Pacing'],
    description:
      'Looking for a dedicated editor to craft 2 high-retention long-form videos + 5 shorts per week. Pacing and motion graphic sound design are critical.',
    clientTrust: 'Verified Client • 100% Payment History',
  },
  {
    id: 'demo-2',
    roleCategory: 'UI/UX Design',
    title: 'Senior UI/UX Designer — AI Workflow Dashboard Redesign',
    client: 'Krypton Labs',
    budget: '$4,500 fixed',
    timeline: '3 weeks',
    source: 'Twitter Founder Feed',
    postedTime: '18m ago',
    matchScore: 97,
    tags: ['Figma', 'Design Systems', 'Dark UI', 'SaaS UX'],
    description:
      'Series A funded AI startup needing a comprehensive UI refresh of our core analytics canvas. Looking for clean typography and high-density dashboards.',
    clientTrust: 'Funded Startup • Escrow Funded',
  },
  {
    id: 'demo-3',
    roleCategory: 'Development',
    title: 'Full-Stack React & Next.js Engineer — Real-time Analytics Hub',
    client: 'DataVibe Analytics',
    budget: '$6,000 / mo or $75/hr',
    timeline: 'Part-Time Contract',
    source: 'Reddit r/Jobbit',
    postedTime: '24m ago',
    matchScore: 98,
    tags: ['React 18', 'Next.js', 'FastAPI', 'Tailwind CSS'],
    description:
      'Seeking a reliable engineer to build customer-facing interactive reporting widgets and integrate streaming OpenAI APIs. Clean codebase ready.',
    clientTrust: 'Verified Agency • Fast Payouts',
  },
  {
    id: 'demo-4',
    roleCategory: 'Copywriting',
    title: 'B2B SaaS Authority Ghostwriter — Weekly Founder Newsletter',
    client: 'SaaSGrowth Studio',
    budget: '$500 per edition',
    timeline: 'Weekly Recurring',
    source: 'Reddit r/HireaWriter',
    postedTime: '31m ago',
    matchScore: 96,
    tags: ['Ghostwriting', 'Substack', 'B2B SaaS', 'Thought Leadership'],
    description:
      'Seeking an authoritative writer to craft our weekly technical founder newsletter. Must distill complex developer tools into engaging prose.',
    clientTrust: 'Active Publisher • Direct Bank Transfer',
  },
  {
    id: 'demo-5',
    roleCategory: 'Growth Marketing',
    title: 'Paid Acquisition Specialist — Meta & TikTok Ads for DTC Brand',
    client: 'Nordic Clean Living',
    budget: '$3,500 / mo retainer',
    timeline: 'Monthly Retainer',
    source: 'Public Facebook Brand Group',
    postedTime: '45m ago',
    matchScore: 95,
    tags: ['Meta Ads', 'TikTok Ads', 'Creative Strategy', 'ROAS Optimization'],
    description:
      'Scaling our direct-to-consumer store from $50k to $200k monthly revenue. Looking for a strategic media buyer with strong creative hook instincts.',
    clientTrust: 'Established Brand • Ongoing Contract',
  },
];

// Hero Interactive Preview Cards
const HERO_CARDS = [
  {
    id: 'hero-1',
    title: 'Lead Webflow & Next.js Redesign for FinTech App',
    client: 'NovaPay Labs',
    budget: '$4,500 Fixed',
    timeline: '2-3 Weeks',
    source: 'Reddit r/forhire • 6m ago',
    matchScore: 98,
    tags: ['React', 'Next.js', 'Tailwind', 'Framer Motion'],
    description:
      'Looking for a seasoned developer to convert high-fidelity Figma designs into a blazing fast marketing site. Must know Tailwind and Framer Motion...',
    clientTrust: 'Verified Client • 100% Payment Track Record',
  },
  {
    id: 'hero-2',
    title: 'Lead YouTube Video Editor — Finance & Tech Channel',
    client: 'Vanguard Media',
    budget: '$3,000 / mo retainer',
    timeline: 'Long-term',
    source: 'YouTube Jobs • 14m ago',
    matchScore: 99,
    tags: ['Premiere Pro', 'Motion Titles', 'YouTube Pacing'],
    description:
      'Need an experienced video editor who understands high-retention editing, sound design, and narrative pacing. 2 videos per week.',
    clientTrust: 'Established Channel • Consistent Weekly Payouts',
  },
  {
    id: 'hero-3',
    title: 'Senior Product Designer — AI Analytics Dashboard',
    client: 'Synthetix AI',
    budget: '$5,200 Fixed',
    timeline: '3-4 Weeks',
    source: 'Twitter Founder Feed • 20m ago',
    matchScore: 96,
    tags: ['Figma', 'UI/UX', 'Design System', 'SaaS'],
    description:
      'Redesigning our core analytics platform. Looking for a designer with strong visual polish and experience with high-density data visualizations.',
    clientTrust: 'Funded Startup • Escrow Secured',
  },
];

// -------------------------------------------------------------
// FAQs for Section 11
// -------------------------------------------------------------
const FAQ_ITEMS = [
  {
    q: 'How does Tinder for Freelancers discover client gigs?',
    a: 'Our intelligent AI Agent monitors high-signal public hiring channels across Reddit (subreddits like r/forhire, r/Jobbit, r/designjobs), Twitter/X hiring hashtags, public Facebook groups and pages, and YouTube job calls. It parses natural client language, verifies authentic hiring intent, strips out spam or rev-share proposals, and routes genuine opportunities directly into your feed.',
  },
  {
    q: 'How does the AI match score calculate compatibility?',
    a: 'Your profile skills, target hourly/fixed rates, and experience are analyzed against the client’s project requirements and budget in real time. The AI produces a compatibility percentage (0–100%) so you can prioritize the gigs where your chances of closing the client are highest.',
  },
  {
    q: 'Do you take any commission or percentage from my earnings?',
    a: 'Zero percent (0%). Unlike Upwork, Fiverr, or traditional freelance marketplaces that slice 10% to 20% off your earnings for life, you keep 100% of whatever you bill your client. You contract and get paid directly by the client.',
  },
  {
    q: 'How does the 8-hour application quota work?',
    a: 'To maintain client trust and prevent spamming, applications operate on an 8-hour rolling quota. Free users receive 5 applications every 8 hours (up to 15/day). Plus members get 15 applications every 8 hours (45/day), and Pro members enjoy 25 applications every 8 hours (75/day). Quotas replenish automatically.',
  },
  {
    q: 'How does AI opportunity qualification and matching work?',
    a: 'Our AI continuously indexes verified opportunities across top remote freelance channels, evaluates your skills and preferences against job requirements, and generates a personalized fit score so you only review high-probability leads.',
  },
  {
    q: 'Do I need a credit card to get started?',
    a: 'No credit card is required. You can sign up with your phone number and immediately start browsing, saving, and applying to opportunities on the Free tier with full access to built-in discovery channels.',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Persona tab state
  const [activePersona, setActivePersona] = useState('video');

  // Hero Card State
  const [heroCardIndex, setHeroCardIndex] = useState(0);
  const [heroFeedback, setHeroFeedback] = useState(null); // 'applied' | 'skipped'

  // Interactive Demo State
  const [demoIndex, setDemoIndex] = useState(0);
  const [demoFeedback, setDemoFeedback] = useState(null); // 'applied' | 'skipped'
  const [isDragging, setIsDragging] = useState(false);

  // Motion values for demo swipe
  const dragX = useMotionValue(0);
  const cardRotate = useTransform(dragX, [-200, 200], [-18, 18]);
  const appliedOpacity = useTransform(dragX, [30, 100], [0, 1]);
  const skipOpacity = useTransform(dragX, [-30, -100], [0, 1]);

  // Pricing Toggle (monthly vs annual) & Currency Switcher (USD vs INR)
  const [isAnnual, setIsAnnual] = useState(false);
  const [currency, setCurrency] = useState('USD'); // 'USD' | 'INR'

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(0);

  // Handle Hero Actions
  const handleHeroAction = (action) => {
    setHeroFeedback(action);
    setTimeout(() => {
      setHeroFeedback(null);
      setHeroCardIndex((prev) => (prev + 1) % HERO_CARDS.length);
    }, 450);
  };

  // Handle Demo Actions
  const handleDemoAction = (action) => {
    setDemoFeedback(action);
    setTimeout(() => {
      setDemoFeedback(null);
      setDemoIndex((prev) => prev + 1);
      dragX.set(0);
    }, 450);
  };

  const handleDragEnd = (event, info) => {
    setIsDragging(false);
    const threshold = 75;
    if (info.offset.x > threshold || info.velocity.x > 350) {
      handleDemoAction('applied');
    } else if (info.offset.x < -threshold || info.velocity.x < -350) {
      handleDemoAction('skipped');
    } else {
      dragX.set(0);
    }
  };

  const handleResetDemo = () => {
    setDemoIndex(0);
    setDemoFeedback(null);
    dragX.set(0);
  };

  const [popupBlocked, setPopupBlocked] = useState(false);

  // Centralized helper: open /login in a new browser tab without redirecting landing page
  const openLoginInNewTab = (params = '') => {
    try {
      const url = params ? `/login${params.startsWith('?') ? params : `?${params}`}` : '/login';
      const newTab = window.open(url, '_blank', 'noopener,noreferrer');
      if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
        setPopupBlocked(true);
        // Popup blocked fallback: does NOT redirect landing tab; preserves navigate('/login') compatibility
      } else {
        setPopupBlocked(false);
      }
    } catch {
      setPopupBlocked(true);
      // Fallback preserves navigate('/login')
    }
  };

  const handleStartDemo = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      const newTab = window.open('/login', '_blank', 'noopener,noreferrer');
      if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
        setPopupBlocked(true);
      } else {
        setPopupBlocked(false);
      }
    } catch {
      setPopupBlocked(true);
    }
  };

  const handleGoToApp = (e, customParams = '') => {
    if (e && e.preventDefault) e.preventDefault();
    openLoginInNewTab(customParams);
  };

  // APK Download State: 'idle' | 'downloading' | 'started' | 'error'
  const [downloadState, setDownloadState] = useState({
    activeButton: null, // 'android' | 'android-bottom' | 'mobile'
    status: 'idle',
    errorMessage: '',
  });

  const handleDownloadApk = async (buttonType) => {
    if (downloadState.status === 'downloading') return;

    // Verify APK configuration exists and is not empty
    if (!APK_CONFIG || !APK_CONFIG.url || !APK_CONFIG.url.trim()) {
      setDownloadState({
        activeButton: buttonType,
        status: 'error',
        errorMessage: 'Android APK coming soon / download currently unavailable.',
      });
      setTimeout(() => {
        setDownloadState({ activeButton: null, status: 'idle', errorMessage: '' });
      }, 5000);
      return;
    }

    setDownloadState({
      activeButton: buttonType,
      status: 'downloading',
      errorMessage: '',
    });

    try {
      // 1. Verify availability of the APK file before triggering download
      const headCheck = await fetch(APK_CONFIG.url, { method: 'HEAD' }).catch(() => null);
      if (headCheck && !headCheck.ok && headCheck.status === 404) {
        throw new Error('Android APK coming soon / download currently unavailable.');
      }

      // 2. Trigger programmatic download without redirecting the user away
      const link = document.createElement('a');
      link.href = APK_CONFIG.url;
      link.download = APK_CONFIG.fileName || 'app-release.apk';
      link.setAttribute('target', '_blank');
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 3. Show "Download Started ✓" state
      setDownloadState({
        activeButton: buttonType,
        status: 'started',
        errorMessage: '',
      });

      // 4. Reset to idle after 3.5 seconds
      setTimeout(() => {
        setDownloadState({
          activeButton: null,
          status: 'idle',
          errorMessage: '',
        });
      }, 3500);
    } catch (err) {
      console.error('Failed to initiate APK download:', err);
      setDownloadState({
        activeButton: buttonType,
        status: 'error',
        errorMessage: err.message || 'Android APK coming soon / download currently unavailable.',
      });

      setTimeout(() => {
        setDownloadState({
          activeButton: null,
          status: 'idle',
          errorMessage: '',
        });
      }, 5000);
    }
  };

  return (
    <div className="min-h-screen bg-[#141212] text-[#FAF7F2] font-sans selection:bg-rose-500/30 selection:text-rose-200">
      {/* ========================================================= */}
      {/* 1. STICKY NAVBAR                                          */}
      {/* ========================================================= */}
      <nav className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#141212]/85 border-b border-neutral-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Compact Job/Freelance Logo */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#E11D48] to-[#F43F6E] p-0.5 shadow-md shadow-rose-900/40 group-hover:scale-105 transition-transform flex-shrink-0">
              <div className="w-full h-full bg-[#141212] rounded-[6px] flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-[#F43F6E]" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-[#FAF7F2] inline-flex items-center gap-1.5 whitespace-nowrap leading-none">
                <span>Tinder for Freelancers</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 leading-none">
                  Beta
                </span>
              </span>
              <span className="text-[11px] text-neutral-400 -mt-0.5 hidden sm:block">
                Swipe. Match. Get Hired.
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-300">
            <a href="#how-it-works" className="hover:text-rose-400 transition-colors">
              How It Works
            </a>
            <a href="#features" className="hover:text-rose-400 transition-colors">
              Features
            </a>
            <a href="#demo" className="hover:text-rose-400 transition-colors flex items-center gap-1">
              <Play className="w-3.5 h-3.5 text-rose-500" />
              Interactive Demo
            </a>
            <a href="#sources" className="hover:text-rose-400 transition-colors">
              Sources
            </a>
            <a href="#pricing" className="hover:text-rose-400 transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-rose-400 transition-colors">
              FAQ
            </a>
          </div>

          {/* Nav Right CTA */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/jobs')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
              >
                <span>Go to Job Feed</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => openLoginInNewTab()}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 active:scale-95 transition-all"
                >
                  Log In
                </button>
                <button
                  onClick={() => openLoginInNewTab()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#E11D48] to-[#F43F6E] hover:from-rose-600 hover:to-rose-500 shadow-md shadow-rose-900/30 hover:shadow-rose-900/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-neutral-800/80 text-neutral-300 hover:text-white focus:outline-none active:scale-95"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden px-4 pb-4 pt-2 bg-[#141212]/95 border-b border-neutral-800 flex flex-col gap-2.5 text-sm font-medium"
            >
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 text-neutral-300 hover:text-rose-400"
              >
                How It Works
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 text-neutral-300 hover:text-rose-400"
              >
                Features
              </a>
              <a
                href="#demo"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 text-neutral-300 hover:text-rose-400 flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 text-rose-500" />
                Interactive Demo
              </a>
              <a
                href="#sources"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 text-neutral-300 hover:text-rose-400"
              >
                Supported Sources
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 text-neutral-300 hover:text-rose-400"
              >
                Pricing Plans
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 text-neutral-300 hover:text-rose-400"
              >
                FAQ
              </a>
              <div className="pt-2 border-t border-neutral-800 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleDownloadApk('mobile');
                  }}
                  className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-[#E11D48] to-[#F43F6E] flex items-center justify-center gap-2 shadow-lg shadow-rose-900/40 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Android App (APK)</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ========================================================= */}
      {/* 2. HERO SECTION                                           */}
      {/* ========================================================= */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32 px-4 sm:px-6 lg:px-8">
        {/* Glow ambient backgrounds */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] md:w-[900px] h-[400px] bg-gradient-to-b from-[#E11D48]/20 via-[#F43F6E]/10 to-transparent blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-1/3 right-5 w-72 h-72 bg-[#D4A373]/10 blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 shadow-inner mb-6">
              <Sparkles className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-medium text-neutral-300">
                Next-Gen AI Opportunity Scout & Auto-Pitcher
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#FAF7F2] leading-[1.1] mb-6">
              Swipe. Match.{' '}
              <span className="bg-gradient-to-r from-[#E11D48] via-[#F43F6E] to-[#D4A373] bg-clip-text text-transparent">
                Get Hired.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg md:text-xl text-neutral-300 max-w-2xl leading-relaxed mb-8">
              Stop doomscrolling noisy job boards and racing to the bottom in 50-bid wars. Our intelligent{' '}
              <span className="text-[#FAF7F2] font-semibold">AI Agent</span> scouts Reddit, X,
              Facebook, and YouTube 24/7—matching high-intent clients directly to your craft with
              tailored pitches ready in one swipe.
            </p>

            {/* CTA Buttons */}
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3.5 mb-4">
              {/* Button 1: Start Demo */}
              <button
                onClick={handleStartDemo}
                className="w-full sm:w-auto px-7 py-4 rounded-xl text-sm sm:text-base font-bold text-white bg-gradient-to-r from-[#E11D48] to-[#F43F6E] hover:from-rose-600 hover:to-rose-500 shadow-xl shadow-rose-900/30 hover:shadow-rose-900/50 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                title="Start Demo"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Demo</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Button 2: Download Android App */}
              <button
                onClick={() => handleDownloadApk('android')}
                disabled={downloadState.status === 'downloading'}
                className="w-full sm:w-auto px-6 py-4 rounded-xl text-sm sm:text-base font-semibold text-neutral-200 bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/80 hover:border-neutral-600 hover:-translate-y-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2.5 disabled:opacity-85"
                title="Download Android APK"
              >
                {downloadState.activeButton === 'android' && downloadState.status === 'downloading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                    <span>Downloading…</span>
                  </>
                ) : downloadState.activeButton === 'android' && downloadState.status === 'started' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300 font-bold">Download Started ✓</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4 text-rose-400" />
                    <span>Download Android App</span>
                    <Download className="w-4 h-4 text-neutral-400" />
                  </>
                )}
              </button>
            </div>

            {/* Popup Blocked Graceful Fallback Notice */}
            {popupBlocked && (
              <div className="w-full sm:w-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>Popup blocked by browser.</span>
                <a
                  href="/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold hover:text-white ml-1 inline-flex items-center gap-1"
                >
                  Click here to open Login <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Inline Download Status Feedback / Error Message */}
            {downloadState.status === 'error' && (
              <div className="w-full sm:w-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{downloadState.errorMessage}</span>
              </div>
            )}
            {downloadState.status === 'started' && (
              <div className="w-full sm:w-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs mb-4">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <span>APK download initiated. Open downloaded package to install.</span>
              </div>
            )}

            {/* Trust signals */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-y-2 gap-x-6 text-xs text-neutral-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-rose-400" />
                0% platform commission
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                60-second setup
              </span>
            </div>
          </div>

          {/* Right Column: Realistic Interactive App Card Preview */}
          <div className="lg:col-span-5 flex justify-center w-full">
            <div className="relative w-full max-w-sm">
              {/* Decorative background glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-rose-600/30 to-amber-500/20 rounded-3xl blur-2xl -z-10 transform -rotate-1 scale-105" />

              {/* Realistic Mobile Job Card Frame */}
              <div className="bg-[#1C1A1A] border border-neutral-700/80 rounded-3xl p-5 shadow-2xl relative overflow-hidden transition-all hover:border-neutral-600">
                <AnimatePresence mode="wait">
                  {(() => {
                    const heroCard = HERO_CARDS[heroCardIndex];
                    return (
                      <motion.div
                        key={heroCard.id}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          x: heroFeedback === 'applied' ? 120 : -120,
                          rotate: heroFeedback === 'applied' ? 12 : -12,
                          transition: { duration: 0.3 },
                        }}
                        transition={{ duration: 0.25 }}
                        className="relative"
                      >
                        {/* Stamp Overlay on Hero Preview */}
                        {heroFeedback && (
                          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                            <span
                              className={`px-5 py-2 rounded-2xl font-black text-base uppercase tracking-wider shadow-2xl border-2 ${
                                heroFeedback === 'applied'
                                  ? 'bg-rose-500 text-white border-rose-300 rotate-[-6deg]'
                                  : 'bg-neutral-800 text-neutral-200 border-neutral-600 rotate-[6deg]'
                              }`}
                            >
                              {heroFeedback === 'applied' ? 'Applied! ❤️' : 'Skipped! ✕'}
                            </span>
                          </div>
                        )}

                        {/* Card Top bar: Match pill & Source */}
                        <div className="flex items-center justify-between gap-2 mb-3.5">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{heroCard.matchScore}% Match</span>
                          </div>
                          <span className="text-[11px] font-medium text-neutral-400 bg-neutral-800/80 px-2.5 py-1 rounded-full border border-neutral-700/50 truncate max-w-[170px]">
                            {heroCard.source}
                          </span>
                        </div>

                        {/* Job Title & Client */}
                        <h3 className="text-lg font-bold text-white mb-1.5 leading-snug">
                          {heroCard.title}
                        </h3>
                        <p className="text-xs text-neutral-400 mb-3 flex items-center gap-1.5">
                          <span className="font-semibold text-neutral-300">{heroCard.client}</span>
                          <span>•</span>
                          <span className="text-emerald-400 flex items-center gap-0.5">
                            <ShieldCheck className="w-3.5 h-3.5" /> {heroCard.clientTrust}
                          </span>
                        </p>

                        {/* Budget & Type tags */}
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5" /> {heroCard.budget}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-medium flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-neutral-400" /> {heroCard.timeline}
                          </span>
                        </div>

                        {/* Job description snippet */}
                        <p className="text-xs text-neutral-300 line-clamp-3 mb-4 leading-relaxed bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
                          "{heroCard.description}"
                        </p>

                        {/* Skills tags */}
                        <div className="flex flex-wrap gap-1.5 mb-5">
                          {heroCard.tags.map((skill) => (
                            <span
                              key={skill}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700/60"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>

                {/* 3D Action Bar: Skip and Apply */}
                <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-3">
                  <button
                    onClick={() => handleHeroAction('skipped')}
                    disabled={!!heroFeedback}
                    className="flex-1 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:translate-y-0.5 active:scale-95 text-neutral-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-neutral-950/60 hover:-translate-y-0.5 transition-all"
                  >
                    <X className="w-4 h-4 text-neutral-400" />
                    <span>Skip</span>
                  </button>

                  <button
                    onClick={() => handleHeroAction('applied')}
                    disabled={!!heroFeedback}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#F43F6E] hover:from-rose-600 hover:to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/60 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 transition-all"
                  >
                    <Heart className="w-4 h-4 fill-white" />
                    <span>Apply</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. PERSONALIZED COPY / FREELANCE ROLE SWITCHER             */}
      {/* ========================================================= */}
      <section className="py-16 md:py-24 bg-[#181616] border-y border-neutral-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-rose-400 mb-2">
              Tailored For Your Craft
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-[#FAF7F2] tracking-tight">
              Whatever you build, AI Agent finds your highest-paying clients
            </p>
            <p className="text-neutral-400 text-sm sm:text-base mt-3">
              Select your specialty to see real matching opportunities and custom search channels.
            </p>
          </div>

          {/* Role selector tabs */}
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 mb-10 no-scrollbar">
            {Object.values(PERSONA_DATA).map((persona) => {
              const IconComp = persona.icon;
              const isSelected = activePersona === persona.id;
              return (
                <button
                  key={persona.id}
                  onClick={() => setActivePersona(persona.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shadow-sm hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#E11D48] to-[#F43F6E] text-white shadow-lg shadow-rose-900/30'
                      : 'bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  <span>{persona.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Persona Showcase Panel */}
          {(() => {
            const persona = PERSONA_DATA[activePersona];
            const sample = persona.sampleJob;
            return (
              <motion.div
                key={persona.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#1F1C1C] border border-neutral-700/80 rounded-3xl p-6 sm:p-8 shadow-xl"
              >
                {/* Left details */}
                <div className="lg:col-span-6 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold w-fit mb-3">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Specialized Pipeline</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-snug">
                    {persona.headline}
                  </h3>
                  <p className="text-neutral-300 text-sm sm:text-base leading-relaxed mb-6">
                    {persona.description}
                  </p>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-800">
                    <div>
                      <span className="text-xs text-neutral-400 block mb-1">Target Client Rate</span>
                      <span className="text-lg font-extrabold text-white">{persona.avgRate}</span>
                    </div>
                    <div>
                      <span className="text-xs text-neutral-400 block mb-1">Monitored Sources</span>
                      <div className="flex flex-wrap gap-1">
                        {persona.popularSources.map((src, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-medium text-neutral-300 bg-neutral-800 px-2 py-0.5 rounded"
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      onClick={handleGoToApp}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#E11D48] to-[#F43F6E] hover:from-rose-600 hover:to-rose-500 shadow-md shadow-rose-900/30 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 transition-all inline-flex items-center gap-2"
                    >
                      <span>Find {persona.name} Gigs</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Right sample gig card */}
                <div className="lg:col-span-6">
                  <div className="bg-[#141212] border border-neutral-700/90 rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> {sample.matchScore}% Match
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {sample.source} • {sample.time}
                      </span>
                    </div>

                    <h4 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                      {sample.title}
                    </h4>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-xs font-bold text-rose-300 bg-rose-500/10 px-2.5 py-0.5 rounded border border-rose-500/30">
                        {sample.budget}
                      </span>
                      <span className="text-xs text-neutral-300 bg-neutral-800 px-2 py-0.5 rounded">
                        {sample.type}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed mb-4 bg-neutral-900/80 p-3 rounded-xl border border-neutral-800">
                      "{sample.snippet}"
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {sample.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded border border-neutral-700/50 font-medium"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. HOW IT WORKS (Build Profile → Connect → AI Agent → Apply) */}
      {/* ========================================================= */}
      <section id="how-it-works" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-rose-400 mb-2">
            Seamless 4-Step Process
          </h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-[#FAF7F2] tracking-tight">
            How Tinder for Freelancers Works
          </p>
          <p className="text-neutral-400 text-sm sm:text-base mt-3">
            From setup to landing high-paying contracts in a few daily swipes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: '01',
              title: 'Build Your Profile',
              desc: 'Select your primary skills, preferred rates, and portfolio highlights in under 60 seconds.',
              icon: Briefcase,
              color: 'from-rose-500 to-rose-600',
            },
            {
              step: '02',
              title: 'Connect',
              desc: 'Choose your focus categories and discover gigs across verified public client streams and networks.',
              icon: Globe,
              color: 'from-amber-500 to-rose-500',
            },
            {
              step: '03',
              title: 'AI Agent',
              desc: 'Your dedicated AI Agent continuously scours public hiring channels 24/7, filtering out low-ballers and spam.',
              icon: Bot,
              color: 'from-rose-500 to-pink-500',
            },
            {
              step: '04',
              title: 'Apply Smarter',
              desc: 'Review matched client gigs in a single swipe feed. Generate tailored proposals and submit directly with 0% platform fee.',
              icon: Send,
              color: 'from-emerald-500 to-teal-500',
            },
          ].map((item, idx) => {
            const StepIcon = item.icon;
            return (
              <div
                key={idx}
                className="bg-[#1A1818] border border-neutral-800 rounded-2xl p-6 relative overflow-hidden group hover:border-neutral-700 transition-all shadow-md"
              >
                <div className="text-4xl font-black text-neutral-800/80 group-hover:text-rose-500/20 transition-colors mb-4">
                  {item.step}
                </div>
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${item.color} flex items-center justify-center text-white mb-4 shadow-md`}
                >
                  <StepIcon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. FEATURE SECTION (6 CARDS BENTO GRID)                   */}
      {/* ========================================================= */}
      <section id="features" className="py-20 md:py-28 bg-[#181616] border-y border-neutral-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-rose-400 mb-2">
              Unfair Advantage
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-[#FAF7F2] tracking-tight">
              Engineered to Land You Clients First
            </p>
            <p className="text-neutral-400 text-sm sm:text-base mt-3">
              Built by freelancers who were exhausted by platform fees, noisy spam, and endless bidding wars.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'AI Agent Multi-Source Discovery',
                desc: 'Continuous real-time ingestion from Reddit subreddits, X/Twitter hiring hashtags, public Facebook business groups, and YouTube job calls.',
                icon: Globe,
                badge: 'Live Discovery',
              },
              {
                title: 'AI Fit & Compatibility Scoring',
                desc: 'Instant 0–100% match score computed against your exact skills, rates, and past work. Know immediately if a gig is worth your time.',
                icon: Sparkles,
                badge: 'Semantic AI',
              },
              {
                title: '1-Click Tailored Pitch Writer',
                desc: 'Generate highly personalized, persuasive proposal notes that cite client pain points without sounding like robotic generic ChatGPT copy.',
                icon: PenTool,
                badge: 'High Conversion',
              },
              {
                title: 'Client Intent & Anti-Spam Filter',
                desc: 'Filters out "rev-share" scams, unpaid test tasks, link drops, and low-ball budgets before they ever reach your feed.',
                icon: ShieldCheck,
                badge: 'Pure Signal',
              },
              {
                title: 'Application Tracking & Pipeline',
                desc: 'Keep your saved opportunities, drafts, and active applications organized in one streamlined dashboard without messy spreadsheets.',
                icon: Layers,
                badge: 'Organized Flow',
              },
              {
                title: 'AI Opportunity Matching (Pro)',
                desc: 'Continuous background discovery, intelligent fit scoring, and tailored proposal drafts ready for your review and manual decision.',
                icon: Zap,
                badge: 'Smart Discovery',
              },
            ].map((feature, i) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={i}
                  className="bg-[#1C1A1A] border border-neutral-800 hover:border-neutral-700 rounded-2xl p-6 transition-all group flex flex-col justify-between shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold text-neutral-400 bg-neutral-800/80 px-2.5 py-1 rounded-full border border-neutral-700/40 uppercase tracking-wider">
                        {feature.badge}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-rose-300 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 6. INTERACTIVE SWIPE DEMO (STANDALONE 3D SWIPE)            */}
      {/* ========================================================= */}
      <section id="demo" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold mb-3">
            <Play className="w-3.5 h-3.5 fill-rose-400" />
            <span>Interactive Simulator</span>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-[#FAF7F2] tracking-tight">
            Swipe. Match. Apply.
          </p>
          <p className="text-neutral-400 text-sm sm:text-base mt-2">
            Drag the card left to <span className="text-neutral-300 font-semibold">Skip</span> or right to{' '}
            <span className="text-rose-400 font-semibold">Apply</span>.
          </p>
        </div>

        {/* Swipe Card Stage with 3D Stack Depth */}
        <div className="max-w-md mx-auto relative min-h-[480px] flex flex-col items-center justify-center select-none">
          {demoIndex < DEMO_CARDS.length ? (
            <div className="w-full relative">
              {/* Stack Background Card (Next Card Depth Effect) */}
              {demoIndex + 1 < DEMO_CARDS.length && (
                <div
                  className="absolute inset-0 bg-[#171515] border border-neutral-800/80 rounded-3xl p-6 shadow-lg pointer-events-none transform translate-y-3 scale-[0.95] opacity-50 z-0"
                  aria-hidden="true"
                >
                  <div className="flex items-center justify-between mb-4 opacity-40">
                    <span className="px-3 py-1 rounded-full bg-neutral-800 text-neutral-400 text-xs">
                      {DEMO_CARDS[demoIndex + 1].matchScore}% Match
                    </span>
                    <span className="text-xs text-neutral-500">
                      {DEMO_CARDS[demoIndex + 1].source}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-neutral-400 truncate opacity-40">
                    {DEMO_CARDS[demoIndex + 1].title}
                  </h3>
                </div>
              )}

              {/* Active Draggable 3D Card */}
              {(() => {
                const card = DEMO_CARDS[demoIndex];
                return (
                  <motion.div
                    style={{
                      x: dragX,
                      rotate: cardRotate,
                    }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.85}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={handleDragEnd}
                    className="relative z-10 cursor-grab active:cursor-grabbing bg-[#1C1A1A] border border-neutral-700/90 rounded-3xl p-6 shadow-2xl transition-shadow hover:shadow-rose-950/20"
                  >
                    {/* Live Visual Stamps while dragging or action */}
                    <motion.div
                      style={{ opacity: appliedOpacity }}
                      className="absolute top-6 right-6 pointer-events-none z-30"
                    >
                      <span className="px-4 py-1.5 rounded-xl font-black text-sm uppercase tracking-wider bg-rose-500 text-white border-2 border-rose-300 shadow-xl rotate-[12deg] inline-block">
                        APPLIED ❤️
                      </span>
                    </motion.div>

                    <motion.div
                      style={{ opacity: skipOpacity }}
                      className="absolute top-6 left-6 pointer-events-none z-30"
                    >
                      <span className="px-4 py-1.5 rounded-xl font-black text-sm uppercase tracking-wider bg-neutral-800 text-neutral-200 border-2 border-neutral-500 shadow-xl rotate-[-12deg] inline-block">
                        SKIPPED ✕
                      </span>
                    </motion.div>

                    {/* Feedback Stamp on Button Click */}
                    <AnimatePresence>
                      {demoFeedback && (
                        <motion.div
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1.05, opacity: 1 }}
                          exit={{ scale: 0.9, opacity: 0 }}
                          className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
                        >
                          <div
                            className={`px-6 py-3 rounded-2xl font-black text-lg tracking-wider uppercase shadow-2xl border-2 ${
                              demoFeedback === 'applied'
                                ? 'bg-rose-600 border-rose-300 text-white rotate-[-6deg]'
                                : 'bg-neutral-800 border-neutral-500 text-neutral-200 rotate-[6deg]'
                            }`}
                          >
                            {demoFeedback === 'applied' && 'APPLIED! ❤️'}
                            {demoFeedback === 'skipped' && 'SKIPPED! ✕'}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Top status */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        {card.matchScore}% Match
                      </span>
                      <span className="text-xs text-neutral-400 font-medium">
                        {card.source} • {card.postedTime}
                      </span>
                    </div>

                    <div className="mb-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                        {card.roleCategory}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-1.5 leading-snug">
                      {card.title}
                    </h3>
                    <p className="text-xs text-neutral-400 mb-3.5 flex items-center gap-1.5">
                      <span className="text-neutral-300 font-semibold">{card.client}</span>
                      <span>•</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> {card.clientTrust}
                      </span>
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold">
                        {card.budget}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-medium">
                        {card.timeline}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-neutral-300 leading-relaxed mb-5 bg-neutral-900/70 p-3.5 rounded-xl border border-neutral-800">
                      "{card.description}"
                    </p>

                    {/* Skill pills */}
                    <div className="flex flex-wrap gap-1.5 mb-6">
                      {card.tags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Action Controls: Skip and Apply with 3D hover/press */}
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-neutral-800">
                      <button
                        onClick={() => handleDemoAction('skipped')}
                        disabled={!!demoFeedback}
                        className="flex-1 py-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 transition-all"
                      >
                        <X className="w-4 h-4 text-neutral-400" />
                        <span>Skip</span>
                      </button>

                      <button
                        onClick={() => handleDemoAction('applied')}
                        disabled={!!demoFeedback}
                        className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#F43F6E] hover:from-rose-600 hover:to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-900/40 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 transition-all"
                      >
                        <Heart className="w-4 h-4 fill-white" />
                        <span>Apply</span>
                      </button>
                    </div>

                    {/* Card counter indicator */}
                    <div className="text-center text-[10px] text-neutral-500 mt-3">
                      Card {demoIndex + 1} of {DEMO_CARDS.length} • Swipe left or right
                    </div>
                  </motion.div>
                );
              })()}
            </div>
          ) : (
            /* End of Demo Screen */
            <div className="w-full bg-[#1C1A1A] border border-neutral-700 rounded-3xl p-8 text-center shadow-2xl flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">You're all caught up in demo mode!</h3>
              <p className="text-xs sm:text-sm text-neutral-300 mb-6 max-w-xs leading-relaxed">
                Ready to swipe real client gigs and start landing contracts?
              </p>

              <div className="w-full flex flex-col gap-2.5">
                <button
                  onClick={handleGoToApp}
                  className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#E11D48] to-[#F43F6E] hover:from-rose-600 hover:to-rose-500 shadow-lg shadow-rose-900/40 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span>Start Real Free Account</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={handleResetDemo}
                  className="w-full py-2.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors"
                >
                  Reset Demo Deck
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 7. AI DIFFERENTIATOR SECTION                               */}
      {/* ========================================================= */}
      <section className="py-20 md:py-28 bg-[#181616] border-y border-neutral-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-rose-400 mb-2">
              Why Freelancers Switch
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-[#FAF7F2] tracking-tight">
              Traditional Job Hunting vs Tinder for Freelancers
            </p>
            <p className="text-neutral-400 text-sm sm:text-base mt-3">
              See why top freelancers are leaving traditional platforms behind.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* The Old Way */}
            <div className="bg-[#1F1B1B] border border-red-950/60 rounded-3xl p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                  <X className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-200">The Traditional Way</h3>
                  <span className="text-xs text-neutral-400">Upwork, Freelancer, Job Boards</span>
                </div>
              </div>

              <ul className="space-y-4 text-xs sm:text-sm text-neutral-300">
                {[
                  'Compete with 50+ cheap proposals within minutes of posting',
                  'Lose 10% to 20% of every invoice in platform commission cuts',
                  'Spend 3–4 hours every day manually scrolling through noisy boards',
                  'Write custom cover letters from scratch that get skimmed or ignored',
                  'High connect costs and paywalls just to submit a proposal',
                  'Restricted to clients who already use that specific marketplace',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="p-0.5 rounded-full bg-red-500/20 text-red-400 mt-0.5">
                      <X className="w-3.5 h-3.5" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* The Tinder for Freelancers Way */}
            <div className="bg-[#1C1F1D] border border-emerald-900/60 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-l from-emerald-500 to-teal-600 text-neutral-950 font-black text-[10px] uppercase tracking-wider rounded-bl-xl">
                The Smart Choice
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Tinder for Freelancers</h3>
                  <span className="text-xs text-emerald-400 font-medium">AI Agent Discovery Feed</span>
                </div>
              </div>

              <ul className="space-y-4 text-xs sm:text-sm text-neutral-200">
                {[
                  'First-mover advantage: Contact clients before thousands see their post',
                  '0% platform commission — keep 100% of your earnings forever',
                  'Spend just 5 minutes a day reviewing pre-qualified high-fit gigs',
                  'AI drafts laser-targeted proposals citing exact client specifications',
                  'No connects or bidding currency: simple transparent application quotas',
                  'Monitors Reddit, X, Facebook, and remote feeds for hidden opportunities',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 8. SUPPORTED SOURCES / DISCOVERY NETWORK                   */}
      {/* ========================================================= */}
      <section id="sources" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-rose-400 mb-2">
            Omnichannel Scanning
          </h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-[#FAF7F2] tracking-tight">
            Where AI Agent Finds Your Next Client
          </p>
          <p className="text-neutral-400 text-sm sm:text-base mt-3">
            AI Agent discovers opportunities from public sources, feeds, APIs, and permitted integrations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              name: 'Reddit Communities',
              desc: 'High-intent client posts on r/forhire, r/Jobbit, r/designjobs, r/HireaWriter, and creator subreddits.',
              stat: '1,200+ posts/day',
              tag: 'Reddit API',
              color: 'text-orange-400',
              icon: Globe,
            },
            {
              name: 'X (Twitter) Hiring Feeds',
              desc: 'Real-time hiring calls from founders, CTOs, and creators looking for immediate contract help.',
              stat: '850+ posts/day',
              tag: 'Social Stream',
              color: 'text-sky-400',
              icon: Globe,
            },
            {
              name: 'Facebook Groups & Pages',
              desc: 'Public Facebook Groups & Pages only. Verified open freelance communities and business pages seeking talent.',
              stat: '450+ posts/day',
              tag: 'Public Communities',
              color: 'text-blue-400',
              icon: Globe,
            },
            {
              name: 'YouTube Jobs',
              desc: 'Hiring calls from creators, podcast studios, and production channels seeking video editors and writers.',
              stat: '250+ posts/day',
              tag: 'Creator Feeds',
              color: 'text-red-400',
              icon: Youtube,
            },
          ].map((src, idx) => {
            const IconComp = src.icon;
            return (
              <div
                key={idx}
                className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between hover:border-neutral-700 transition-all shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-extrabold uppercase tracking-wider ${src.color}`}>
                      {src.tag}
                    </span>
                    <IconComp className="w-4 h-4 text-neutral-500" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-2">{src.name}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed mb-4">{src.desc}</p>
                </div>
                <div className="pt-3 border-t border-neutral-800/80 text-[11px] font-semibold text-neutral-300">
                  {src.stat}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 9. PRICING SECTION (EXACT TIERS: $0 / $7 / $19 - $0/$70/$190) */}
      {/* ========================================================= */}
      <section id="pricing" className="py-20 md:py-28 bg-[#181616] border-y border-neutral-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-rose-400 mb-2">
              Simple, Transparent Pricing
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-[#FAF7F2] tracking-tight">
              Invest in More Contracts, Not Platform Taxes
            </p>
            <p className="text-neutral-400 text-sm sm:text-base mt-3">
              Zero commissions on your contracts. Choose the plan that fits your outreach volume.
            </p>

            {/* Pricing Controls: Monthly/Annual & USD/INR */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              {/* Monthly / Annual Toggle */}
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-neutral-900 border border-neutral-800 shadow-inner">
                <button
                  onClick={() => setIsAnnual(false)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    !isAnnual ? 'bg-neutral-800 text-white shadow' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setIsAnnual(true)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isAnnual ? 'bg-[#E11D48] text-white shadow' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <span>Annual</span>
                  <span className="text-[10px] bg-white text-neutral-900 font-extrabold px-1.5 py-0.2 rounded-full">
                    Save ~17%
                  </span>
                </button>
              </div>

              {/* Currency Switcher Toggle: USD | INR */}
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-neutral-900 border border-neutral-800 shadow-inner">
                <button
                  onClick={() => setCurrency('USD')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    currency === 'USD'
                      ? 'bg-neutral-800 text-white shadow border border-neutral-700/60'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  USD ($)
                </button>
                <button
                  onClick={() => setCurrency('INR')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    currency === 'INR'
                      ? 'bg-neutral-800 text-white shadow border border-neutral-700/60'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  INR (₹)
                </button>
              </div>
            </div>
          </div>

          {/* 3 Tier Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            {/* 1. FREE PLAN */}
            <div className="bg-[#1C1A1A] border border-neutral-800 rounded-3xl p-7 flex flex-col justify-between shadow-lg">
              <div>
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-white mb-1">Free</h3>
                  <p className="text-xs text-neutral-400">Perfect for exploring and casual discovery.</p>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={`free-${currency}-${isAnnual}`}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="text-4xl font-extrabold text-white"
                    >
                      {currency === 'INR' ? '₹0' : '$0'}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-xs text-neutral-400">
                    {isAnnual ? '/ year' : '/ month'}
                  </span>
                </div>

                <div className="space-y-3 text-xs text-neutral-300 mb-8">
                  <div className="flex items-center gap-2.5 font-semibold text-white">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>5 applications every 8 hours (15/day)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>1 custom monitoring source</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Access to built-in discovery channels</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>AI match fit scoring</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Standard pipeline tracking</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-neutral-400">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Manual review & 1-click apply</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleGoToApp}
                className="w-full py-3.5 rounded-xl text-xs font-bold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 hover:text-white hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 transition-all shadow-md"
              >
                Get Started Free
              </button>
            </div>

            {/* 2. PLUS PLAN (Featured) */}
            <div className="bg-[#201D1D] border-2 border-rose-500 rounded-3xl p-7 flex flex-col justify-between relative shadow-2xl shadow-rose-950/40">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#E11D48] to-[#F43F6E] text-white text-[10px] font-black uppercase tracking-wider shadow">
                ⭐ Most Popular
              </div>

              <div>
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-white mb-1">Plus</h3>
                  <p className="text-xs text-rose-300/80">For active freelancers scaling their client pipeline.</p>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={`plus-${currency}-${isAnnual}`}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="text-4xl font-extrabold text-white"
                    >
                      {currency === 'INR'
                        ? isAnnual ? '₹4,990' : '₹499'
                        : isAnnual ? '$70' : '$7'}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-xs text-neutral-400">
                    {isAnnual ? '/ year' : '/ month'}
                  </span>
                </div>

                <div className="space-y-3 text-xs text-neutral-200 mb-8">
                  <div className="flex items-center gap-2.5 font-bold text-white">
                    <Check className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>15 applications every 8 hours (45/day)</span>
                  </div>
                  <div className="flex items-center gap-2.5 font-medium">
                    <Check className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>3 custom monitoring sources</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>Priority discovery feed refresh</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>Advanced AI proposal customizations</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>Direct client contact details</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-neutral-400">
                    <Check className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>Full control over proposal sending</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleGoToApp}
                className="w-full py-3.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#E11D48] to-[#F43F6E] hover:from-rose-600 hover:to-rose-500 shadow-lg shadow-rose-900/40 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 transition-all"
              >
                Upgrade to Plus
              </button>
            </div>

            {/* 3. PRO PLAN */}
            <div className="bg-[#1C1A1A] border border-neutral-800 rounded-3xl p-7 flex flex-col justify-between shadow-lg">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white mb-1">Pro</h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    {/* 🚀 Autopilot */}MAX PIPELINE
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mb-4">High-volume pipeline and priority discovery for top-tier freelancers.</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={`pro-${currency}-${isAnnual}`}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="text-4xl font-extrabold text-white"
                    >
                      {currency === 'INR'
                        ? isAnnual ? '₹14,990' : '₹1,499'
                        : isAnnual ? '$190' : '$19'}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-xs text-neutral-400">
                    {isAnnual ? '/ year' : '/ month'}
                  </span>
                </div>

                <div className="space-y-3 text-xs text-neutral-300 mb-8">
                  <div className="flex items-center gap-2.5 font-bold text-white">
                    <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>25 applications every 8 hours (75/day)</span>
                  </div>
                  <div className="flex items-center gap-2.5 font-medium text-white">
                    <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>5 custom monitoring sources</span>
                  </div>
                  <div className="flex items-center gap-2.5 font-bold text-amber-300">
                    <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Instant AI Match Scoring & Drafts</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Custom search alerts & limits</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>VIP early opportunity access</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Priority dedicated support</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleGoToApp}
                className="w-full py-3.5 rounded-xl text-xs font-bold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 hover:text-white hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 transition-all shadow-md"
              >
                Unlock Pro Membership
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 10. BETA / EARLY ACCESS SECTION                            */}
      {/* ========================================================= */}
      <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="bg-gradient-to-tr from-rose-950/40 via-neutral-900 to-amber-950/30 border border-rose-500/30 rounded-3xl p-8 sm:p-12 relative overflow-hidden text-center shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Early Access</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Get Early Access. Lock In Lifetime Perks.
          </h2>

          <p className="text-neutral-300 text-xs sm:text-base max-w-2xl mx-auto leading-relaxed mb-8">
            We are opening access to ambitious freelancers worldwide. Get early access now to lock in
            lifetime 0% platform commission protections, priority discovery bandwidth, and direct input
            into the product roadmap.
          </p>

          <button
            onClick={handleGoToApp}
            className="px-8 py-3.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#E11D48] to-[#F43F6E] hover:from-rose-600 hover:to-rose-500 shadow-xl shadow-rose-900/40 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 transition-all inline-flex items-center gap-2"
          >
            <span>Claim Your Beta Spot Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 11. FAQ ACCORDION                                          */}
      {/* ========================================================= */}
      <section id="faq" className="py-20 md:py-28 bg-[#181616] border-y border-neutral-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-rose-400 mb-2">
              Frequently Asked Questions
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-[#FAF7F2] tracking-tight">
              Everything You Need to Know
            </p>
          </div>

          <div className="space-y-4">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl overflow-hidden transition-colors shadow-sm"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 focus:outline-none hover:bg-neutral-800/40 transition-colors"
                  >
                    <span className="text-sm sm:text-base font-bold text-white">{item.q}</span>
                    <span className="p-1 rounded-lg bg-neutral-800 text-neutral-400">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-5 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-neutral-300 leading-relaxed border-t border-neutral-800/60 pt-3"
                      >
                        {item.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 12. FINAL CALL TO ACTION BANNER                           */}
      {/* ========================================================= */}
      <section className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Glow ambient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#E11D48]/10 via-transparent to-transparent pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#E11D48] to-[#F43F6E] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-rose-900/40">
            <Briefcase className="w-6 h-6 text-white" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4 leading-tight">
            Ready to Stop Searching and Start Swiping?
          </h2>

          <p className="text-neutral-300 text-sm sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
            Join thousands of freelancers discovering high-paying gigs directly from clients without
            marketplace middlemen.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-4">
            {/* Button 1: Start Demo */}
            <button
              onClick={handleStartDemo}
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold text-white bg-gradient-to-r from-[#E11D48] to-[#F43F6E] hover:from-rose-600 hover:to-rose-500 shadow-2xl shadow-rose-900/50 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
              title="Start Demo"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Start Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Button 2: Download Android App */}
            <button
              onClick={() => handleDownloadApk('android-bottom')}
              disabled={downloadState.status === 'downloading'}
              className="w-full sm:w-auto px-7 py-4 rounded-xl text-base font-semibold text-neutral-200 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700/80 hover:border-neutral-600 hover:-translate-y-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2.5 disabled:opacity-85"
              title="Download Android APK"
            >
              {downloadState.activeButton === 'android-bottom' && downloadState.status === 'downloading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                  <span>Downloading…</span>
                </>
              ) : downloadState.activeButton === 'android-bottom' && downloadState.status === 'started' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300 font-bold">Download Started ✓</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4 text-rose-400" />
                  <span>Download Android App</span>
                  <Download className="w-4 h-4 text-neutral-400" />
                </>
              )}
            </button>
          </div>

          {/* Popup Blocked Graceful Fallback Notice */}
          {popupBlocked && (
            <div className="w-full sm:w-auto max-w-md mx-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span>Popup blocked by browser.</span>
              <a
                href="/login"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold hover:text-white ml-1 inline-flex items-center gap-1"
              >
                Click here to open Login <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Inline Download Status Feedback / Error Message */}
          {downloadState.status === 'error' && (
            <div className="w-full sm:w-auto max-w-md mx-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{downloadState.errorMessage}</span>
            </div>
          )}
          {downloadState.status === 'started' && (
            <div className="w-full sm:w-auto max-w-md mx-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs mb-4">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span>APK download initiated. Open downloaded package to install.</span>
            </div>
          )}

          <p className="text-[11px] text-neutral-400 mt-4">
            Direct APK download • Android 8.0+ supported • No credit card required
          </p>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 13. FOOTER                                                */}
      {/* ========================================================= */}
      <footer className="border-t border-neutral-800/80 bg-[#100E0E] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Col 1: Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#E11D48] to-[#F43F6E] p-0.5 flex-shrink-0 shadow-sm">
                <div className="w-full h-full bg-[#141212] rounded-[5px] flex items-center justify-center">
                  <Briefcase className="w-3.5 h-3.5 text-[#F43F6E]" />
                </div>
              </div>
              <span className="font-bold text-base text-white">Tinder for Freelancers</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed mb-4">
              Swipe. Match. Get Hired. The intelligent opportunity discovery engine for modern freelancers.
            </p>
            <div className="text-[11px] text-neutral-500">
              © {new Date().getFullYear()} Tinder for Freelancers. All rights reserved.
            </div>
          </div>

          {/* Col 2: Product */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
              Product
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>
                <a href="#how-it-works" className="hover:text-rose-400 transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-rose-400 transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#demo" className="hover:text-rose-400 transition-colors">
                  Interactive Demo
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-rose-400 transition-colors">
                  Pricing & Quotas
                </a>
              </li>
              <li>
                <a href="#sources" className="hover:text-rose-400 transition-colors">
                  Monitored Sources
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Resources */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
              Resources
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>
                <a href="#faq" className="hover:text-rose-400 transition-colors">
                  Frequently Asked Questions
                </a>
              </li>
              <li>
                <button
                  onClick={handleGoToApp}
                  className="hover:text-rose-400 transition-colors text-left"
                >
                  Candidate Portal
                </button>
              </li>
              <li>
                <button
                  onClick={() => openLoginInNewTab()}
                  className="hover:text-rose-400 transition-colors text-left"
                >
                  Account Login
                </button>
              </li>
              <li>
                <span className="text-neutral-500 cursor-not-allowed">Community Discord (Coming Soon)</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Legal & Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
              Trust & Security
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>
                <span className="text-neutral-300 font-semibold block">0% Commission Promise</span>
                <span className="text-[11px] text-neutral-500">Direct client-to-freelancer transactions</span>
              </li>
              <li className="pt-2">
                <span className="text-neutral-300 font-semibold block">Privacy First</span>
                <span className="text-[11px] text-neutral-500">Your phone & profile data is never shared</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="max-w-7xl mx-auto pt-6 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-500 gap-2">
          <div>Built for independent video editors, designers, developers, writers & marketers worldwide.</div>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="hover:text-neutral-300 transition-colors"
          >
            Back to top ↑
          </button>
        </div>
      </footer>
    </div>
  );
}
