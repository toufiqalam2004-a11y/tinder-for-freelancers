import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, Play, Pause, Settings, RefreshCw, CheckCircle2, 
  Send, Sparkles, AlertCircle, Clock, ShieldCheck, 
  Mail, MessageCircle, Calendar, ChevronRight, Check, 
  X, Filter, Eye, Edit3, ArrowRight, UserCheck, Inbox, 
  Flame, ExternalLink, Trash2, Crown, Lock, Zap 
} from 'lucide-react';
import PageTransition from '../components/PageTransition';
import Card from '../components/Card';
import Button from '../components/Button';
import AutopilotSetupWizard from '../components/AutopilotSetupWizard';
import AutopilotIntroAnimation from '../components/AutopilotIntroAnimation';
import LeadDetailsModal from '../components/LeadDetailsModal';
import OutreachComposerModal from '../components/OutreachComposerModal';
import UpgradeModal from '../components/UpgradeModal';
import { subscriptionService } from '../services/subscriptionService.js';
import { useProfile } from '../contexts/ProfileContext';
import {
  getUser,
  hasSeenAutopilotIntro,
  setSeenAutopilotIntro,
  getLeads,
  updateLead,
  addLead,
  getAutopilotSettings,
  saveAutopilotSettings,
  getAgentActivities,
  logAgentActivity,
  getAutopilotStats,
  getDailyOutreachCount,
  saveLeads,
} from '../data/storage.js';
import { createLead, createAgentActivity, createOutreachMessage, createLeadResearch } from '../data/models.js';
import { autopilotEngine } from '../services/autopilotEngine.js';
import { aiProvider } from '../services/aiProvider.js';
import toast from 'react-hot-toast';

const TAB_OPTIONS = [
  { id: 'approval', label: 'Approval Queue', icon: UserCheck },
  { id: 'pipeline', label: 'Pipeline', icon: Flame },
  { id: 'replies', label: 'Replies & Inbox', icon: Inbox },
  { id: 'activity', label: 'Activity Log', icon: Clock },
];

const AutopilotDashboard = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const user = getUser();
  const userId = user?.id || 'default_user';
  const [showIntro, setShowIntro] = useState(() => !hasSeenAutopilotIntro(userId));

  // Plan tiers
  const isPro = subscriptionService.isPro();
  const isPlus = subscriptionService.isPlus();
  const isFree = subscriptionService.isFree();
  const effectiveLimit = isPro ? 100 : (isPlus ? 20 : 5);

  // Settings & Status
  const [settings, setSettings] = useState(() => getAutopilotSettings());
  const [stats, setStats] = useState(() => getAutopilotStats());
  const [leads, setLeads] = useState(() => getLeads());
  const [activities, setActivities] = useState(() => getAgentActivities());

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState('approval');
  const [pipelineFilter, setPipelineFilter] = useState('all');

  // Modals
  const [showWizard, setShowWizard] = useState(false);
  const [selectedLeadForDetails, setSelectedLeadForDetails] = useState(null);
  const [selectedLeadForComposer, setSelectedLeadForComposer] = useState(null);

  // Batch actions in Approval Queue
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
  const [isRunningCycle, setIsRunningCycle] = useState(false);

  // AI Reply Assistant state
  const [replyDrafts, setReplyDrafts] = useState({});

  const refreshData = useCallback(() => {
    setSettings(getAutopilotSettings());
    setStats(getAutopilotStats());
    setLeads(getLeads());
    setActivities(getAgentActivities());
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleCompleteIntro = () => {
    setSeenAutopilotIntro(userId);
    setShowIntro(false);
    if (!settings.autopilotSetupCompleted) {
      setShowWizard(true);
    }
  };

  // Check if first-time intro or setup wizard is needed
  useEffect(() => {
    if (!hasSeenAutopilotIntro(userId)) {
      setShowIntro(true);
      setShowWizard(false);
    } else if (!settings.autopilotSetupCompleted) {
      setShowWizard(true);
    } else {
      setShowWizard(false);
    }
  }, [settings.autopilotSetupCompleted, userId]);

  // Upgrade Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');

  // Toggle Active / Paused
  const handleToggleStatus = () => {
    if (subscriptionService.isFree()) {
      setUpgradeReason('Upgrade to let AI discover, qualify and reach out to opportunities for you.');
      setShowUpgradeModal(true);
      return;
    }

    const newStatus = settings.status === 'active' ? 'paused' : 'active';
    const updated = { ...settings, status: newStatus, updatedAt: new Date().toISOString() };
    saveAutopilotSettings(updated);
    setSettings(updated);

    logAgentActivity(
      createAgentActivity({
        action: newStatus === 'active' ? 'Autopilot Resumed' : 'Autopilot Paused',
        detail: `User set autopilot status to ${newStatus}.`,
        status: newStatus === 'active' ? 'success' : 'warning',
      })
    );

    toast.success(`Autopilot is now ${newStatus.toUpperCase()}`);
    refreshData();
  };

  // Run Discovery & Qualification Cycle
  const handleRunCycle = async () => {
    if (subscriptionService.isFree()) {
      setUpgradeReason('Upgrade to let AI discover, qualify and reach out to opportunities for you.');
      setShowUpgradeModal(true);
      return;
    }

    setIsRunningCycle(true);
    const toastId = toast.loading('Agent discovering and qualifying opportunities...');
    try {
      // If no leads exist yet and jobs are also empty, initialize seed demo leads first
      let currentLeads = getLeads();
      if (currentLeads.length === 0) {
        seedInitialDemoLeads();
      }

      const result = await autopilotEngine.runCycle(profile);
      refreshData();

      if (result.success) {
        toast.success(
          `Cycle completed: ${result.newlyDiscoveredCount || 0} discovered, ${result.qualifiedCount || 0} qualified!`,
          { id: toastId }
        );
      } else if (result.code === 'UPGRADE_REQUIRED') {
        toast.dismiss(toastId);
        setUpgradeReason(result.reason || 'Upgrade to let AI discover, qualify and reach out to opportunities for you.');
        setShowUpgradeModal(true);
      } else {
        toast(result.reason || 'Cycle finished.', { id: toastId, icon: 'ℹ️' });
      }
    } catch (err) {
      toast.error('Failed to run cycle: ' + err.message, { id: toastId });
    } finally {
      setIsRunningCycle(false);
    }
  };

  // Helper to seed realistic demo leads if empty
  const seedInitialDemoLeads = () => {
    const sampleLeads = [
      createLead({
        id: 'lead-yt-1',
        platform: 'youtube',
        name: 'Alex Vance',
        company: 'Vance Tech Media (120k subs)',
        role: 'YouTube Creator',
        opportunityType: 'Client Opportunity',
        title: 'Looking for a dedicated Premiere Pro / After Effects editor for weekly videos',
        description: 'Hey editors! Our channel Vance Tech Media is looking for a long-term video editor. 1-2 videos per week (10-15 mins). Focus on fast-paced retention, clean motion graphics, sound design. Budget: $250 - $400 per video depending on complexity. Email portfolio to alex@vancetechmedia.com',
        sourceUrl: 'https://youtube.com/@vancetechmedia/community',
        email: 'alex@vancetechmedia.com',
        matchScore: 92,
        qualificationScore: 90,
        qualificationReasons: [
          'Clear scope and weekly volume stated',
          'Explicit budget: $250-$400/video',
          'Verified direct email address available',
          'Perfect match for Video Editing & Motion Design',
        ],
        status: 'waiting_approval',
        isDemo: true,
        research: createLeadResearch({
          clientSummary: 'Alex Vance • Vance Tech Media (120k subscribers)',
          verifiedNeed: 'Weekly YouTube tech video editor with motion graphics',
          suggestedAngle: 'Highlight pacing retention, past tech video showreel, and reliable 48h turnaround.',
          knownInfo: [
            'Channel size: 120,000 subscribers with active tech community',
            'Publishing cadence: 1-2 videos/week (10-15 mins length)',
            'Stated budget: $250 - $400 per video',
            'Direct email contact provided: alex@vancetechmedia.com',
          ],
          aiInferences: [
            'Channel is monetized and growing; values dependable deadline delivery over endless revision cycles.',
            'Likely needs dynamic B-roll cut-ins and sound effect accents to sustain 80%+ audience retention.',
          ],
          confidenceScore: 95,
        }),
        outreachMessage: createOutreachMessage({
          leadId: 'lead-yt-1',
          tone: 'Professional',
          subject: 'Video Editor for Vance Tech Media — High-Retention Editing & Motion Graphics',
          fullBody: `Hi Alex,\n\nI came across your post looking for a dedicated video editor for Vance Tech Media. With your 1-2 video weekly cadence and 10-15 minute tech formats, maintaining crisp pacing and dynamic motion graphics is critical for audience retention.\n\nI specialize in tech YouTube editing using Premiere Pro and After Effects, combining punchy visual cuts, smooth zoom accents, and immersive sound design. I can easily meet your 48-hour turnarounds while keeping production quality high.\n\nYou can see my recent video editing showreel here: ${profile.portfolioUrl || 'https://toufiq.in'}\n\nWould you be open to a quick 10-minute chat or doing a test edit for an upcoming video?\n\nBest regards,\n${profile.name || 'Toufiq'}`,
        }),
      }),
      createLead({
        id: 'lead-rd-2',
        platform: 'reddit',
        name: 'SaaS Pulse Studio',
        company: 'Pulse Analytics',
        role: 'Marketing Lead',
        opportunityType: 'Client Opportunity',
        title: '[Hiring] Short-Form Video Editor for TikTok, Shorts & LinkedIn Ads',
        description: 'We are looking for a freelance video editor to turn our podcast episodes and product tutorials into engaging 60-second vertical reels with animated captions. $50/video or $1000/month retainer. DM or WhatsApp +1 (415) 555-0192',
        sourceUrl: 'https://reddit.com/r/forhire',
        phone: '+14155550192',
        matchScore: 88,
        qualificationScore: 85,
        qualificationReasons: [
          'High demand format: vertical short-form repurposing',
          'Offers retainer model ($1000/mo)',
          'Direct WhatsApp contact provided',
        ],
        status: 'waiting_approval',
        isDemo: true,
        research: createLeadResearch({
          clientSummary: 'Pulse Analytics • SaaS B2B startup',
          verifiedNeed: 'Vertical short-form repurposing with kinetic typography',
          suggestedAngle: 'Pitch monthly batch package of 20 shorts with high viral hook rate.',
          knownInfo: [
            'Budget: $50 per short or $1,000 monthly retainer',
            'Content: Podcast long-form to TikTok/Shorts/Reels',
            'Direct WhatsApp contact: +1 415-555-0192',
          ],
          aiInferences: [
            'B2B SaaS marketing team needing consistent social media presence without internal video staff.',
            'Values quick hook in first 3 seconds and accurate subtitling.',
          ],
          confidenceScore: 92,
        }),
        outreachMessage: createOutreachMessage({
          leadId: 'lead-rd-2',
          tone: 'Confident',
          subject: 'Repurposing your podcast into viral shorts & LinkedIn reels',
          fullBody: `Hi team at Pulse Analytics,\n\nI saw your post on r/forhire seeking a short-form editor for your podcast tutorials. Repurposing long-form episodes into high-impact 60-second reels is my core specialty.\n\nI deliver snappy hooks, custom kinetic typography, and B-roll cutaways tailored for TikTok, Shorts, and LinkedIn engagement. I would be thrilled to take this off your plate on your $1,000/mo retainer structure.\n\nHere is a direct link to sample vertical shorts I have edited: ${profile.portfolioUrl || 'https://toufiq.in'}\n\nLet's connect on WhatsApp or hop on a brief call to discuss your next batch!\n\nBest,\n${profile.name || 'Toufiq'}`,
        }),
      }),
      createLead({
        id: 'lead-x-3',
        platform: 'x',
        name: 'Sarah Connor',
        company: 'Connor Health & Fitness',
        role: 'Creator & Coach',
        opportunityType: 'Client Opportunity',
        title: 'Need a video editor ASAP for our new YouTube transformation series',
        description: 'Hiring an editor who understands storytelling and emotional pacing. We film 4K vlogs. Paying competitive rates. Email portfolio to sarah@connorfit.com',
        sourceUrl: 'https://x.com/connorfit/status/183921',
        email: 'sarah@connorfit.com',
        matchScore: 84,
        qualificationScore: 82,
        qualificationReasons: [
          'Urgent hiring need (ASAP)',
          'Verified contact email provided',
          'Matches video storytelling specialization',
        ],
        status: 'waiting_approval',
        isDemo: true,
        research: createLeadResearch({
          clientSummary: 'Sarah Connor • Fitness Brand',
          verifiedNeed: 'Storytelling & documentary vlog editor for YouTube series',
          suggestedAngle: 'Showcase narrative documentary editing and color grading.',
          knownInfo: [
            'Urgency: Immediate start (ASAP)',
            'Format: 4K narrative fitness vlogs',
            'Direct contact email: sarah@connorfit.com',
          ],
          aiInferences: [
            'Looking for higher-tier cinematic feel rather than simple cuts.',
          ],
          confidenceScore: 88,
        }),
        outreachMessage: createOutreachMessage({
          leadId: 'lead-x-3',
          tone: 'Friendly',
          subject: 'Cinematic Video Editor for your YouTube Transformation Series',
          fullBody: `Hi Sarah,\n\nI saw your post looking for a video editor who understands emotional storytelling and pacing for your new transformation series.\n\nBringing real narratives to life with seamless transitions, cinematic color grading, and evocative sound design is my passion. I work natively in 4K Premiere Pro and can deliver polished episodes with zero hassle.\n\nTake a look at some of my recent narrative video projects here: ${profile.portfolioUrl || 'https://toufiq.in'}\n\nI have immediate bandwidth to take this on. When would be a good time for a quick 10-minute intro?\n\nWarm regards,\n${profile.name || 'Toufiq'}`,
        }),
      }),
    ];

    sampleLeads.forEach((l) => addLead(l));

    logAgentActivity(
      createAgentActivity({
        action: 'Discovery Initialized',
        detail: 'Discovered 3 high-qualification opportunities across YouTube, Reddit, and X.',
        status: 'success',
      })
    );
  };

  // Quick Approve individual lead
  const handleQuickApprove = async (leadId) => {
    if (subscriptionService.isFree()) {
      setUpgradeReason('Upgrade to let AI discover, qualify and reach out to opportunities for you.');
      setShowUpgradeModal(true);
      return;
    }

    const result = await autopilotEngine.approveOutreach(leadId, profile);
    if (result.success) {
      toast.success('Proposal approved and outreach recorded!');
      refreshData();
    } else if (result.code === 'UPGRADE_REQUIRED') {
      setUpgradeReason(result.reason || 'Upgrade to let AI discover, qualify and reach out to opportunities for you.');
      setShowUpgradeModal(true);
    } else {
      toast.error(result.reason || 'Failed to approve');
    }
  };

  // Batch approve selected leads
  const handleBatchApprove = async () => {
    if (subscriptionService.isFree()) {
      setUpgradeReason('Upgrade to let AI discover, qualify and reach out to opportunities for you.');
      setShowUpgradeModal(true);
      return;
    }

    const ids = Array.from(selectedLeadIds);
    if (ids.length === 0) return;

    let approvedCount = 0;
    const toastId = toast.loading(`Approving ${ids.length} proposals...`);

    for (const id of ids) {
      const res = await autopilotEngine.approveOutreach(id, profile);
      if (res.success) approvedCount++;
    }

    setSelectedLeadIds(new Set());
    refreshData();

    if (approvedCount > 0) {
      toast.success(`Successfully approved ${approvedCount} proposal(s)!`, { id: toastId });
    } else {
      toast.error('Could not approve selected proposals (daily limit or cooldown reached).', { id: toastId });
    }
  };

  // Batch dismiss
  const handleBatchDismiss = () => {
    const ids = Array.from(selectedLeadIds);
    if (ids.length === 0) return;

    ids.forEach((id) => {
      updateLead(id, { status: 'rejected' });
    });

    logAgentActivity(
      createAgentActivity({
        action: 'Batch Dismissed',
        detail: `Dismissed ${ids.length} opportunities from approval queue.`,
        status: 'info',
      })
    );

    setSelectedLeadIds(new Set());
    refreshData();
    toast.success(`Dismissed ${ids.length} leads.`);
  };

  const handleDismissLead = (leadId) => {
    updateLead(leadId, { status: 'rejected' });
    logAgentActivity(
      createAgentActivity({
        leadId,
        action: 'Lead Dismissed',
        detail: 'User dismissed lead from pipeline.',
        status: 'info',
      })
    );
    toast.success('Lead dismissed.');
    refreshData();
  };

  // Simulate Demo Client Reply
  const handleSimulateReply = async () => {
    let sentLead = leads.find((l) => l.status === 'sent');
    if (!sentLead) {
      // If none sent yet, pick the first lead and mark as sent first
      const firstLead = leads[0];
      if (firstLead) {
        updateLead(firstLead.id, { status: 'sent', lastContactedAt: new Date().toISOString() });
        sentLead = { ...firstLead, status: 'sent' };
      } else {
        seedInitialDemoLeads();
        const freshLeads = getLeads();
        updateLead(freshLeads[0].id, { status: 'sent', lastContactedAt: new Date().toISOString() });
        sentLead = { ...freshLeads[0], status: 'sent' };
      }
    }

    const replySnippets = [
      "Hi! Thanks for reaching out. We loved your showreel and would like to do a quick 15-min call to discuss editing 2 videos next week. Are you free tomorrow?",
      "Hey! Thanks for the proposal. What are your typical turnaround times and rates for 10-minute videos? We have 4 videos ready to edit.",
      "Hello, can you share 1-2 examples of short-form retention edits you did recently? Would love to see dynamic subtitles in action.",
    ];

    const randomSnippet = replySnippets[Math.floor(Math.random() * replySnippets.length)];
    const replyAnalysis = await aiProvider.analyzeReply(randomSnippet);
    const suggestedAIResponse = await aiProvider.generateReply({
      lead: sentLead,
      replyText: randomSnippet,
      intent: replyAnalysis.intent,
      profile,
    });

    updateLead(sentLead.id, {
      status: 'replied',
      clientReply: {
        text: randomSnippet,
        receivedAt: new Date().toISOString(),
        intent: replyAnalysis.intent,
        confidence: replyAnalysis.confidence,
        suggestMeeting: replyAnalysis.suggestMeeting,
        aiSuggestedReply: suggestedAIResponse,
      },
    });

    logAgentActivity(
      createAgentActivity({
        leadId: sentLead.id,
        leadName: sentLead.name,
        action: 'Reply Received',
        detail: `Client replied: "${randomSnippet.slice(0, 60)}..." (Intent: ${replyAnalysis.intent})`,
        status: 'success',
      })
    );

    toast.success(`Client reply simulated from ${sentLead.name}!`);
    setActiveTab('replies');
    refreshData();
  };

  // Suggest Meeting action from reply
  const handleSuggestMeeting = (lead) => {
    updateLead(lead.id, {
      status: 'meeting',
    });

    logAgentActivity(
      createAgentActivity({
        leadId: lead.id,
        leadName: lead.name,
        action: 'Meeting Booked / Scheduled',
        detail: `Intro call proposed & scheduled with ${lead.name}.`,
        status: 'success',
      })
    );

    toast.success(`Meeting proposed to ${lead.name}! Lead moved to Meetings.`);
    refreshData();
  };

  // Filter approval queue items
  const approvalQueue = leads.filter(
    (l) => l.status === 'waiting_approval' || l.status === 'qualified' || l.status === 'ready_to_contact'
  );

  // Filter pipeline items
  const pipelineLeads = leads.filter((l) => {
    if (pipelineFilter === 'all') return l.status !== 'rejected';
    if (pipelineFilter === 'waiting_approval') return l.status === 'waiting_approval' || l.status === 'qualified';
    return l.status === pipelineFilter;
  });

  // Filter replies inbox
  const replyLeads = leads.filter((l) => ['replied', 'interested', 'meeting'].includes(l.status));

  // Toggle selection for batch actions
  const toggleSelectLead = (id) => {
    const next = new Set(selectedLeadIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeadIds(next);
  };

  const handleSelectAllApproval = () => {
    if (selectedLeadIds.size === approvalQueue.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(approvalQueue.map((l) => l.id)));
    }
  };

  return (
    <PageTransition>
      <div className="px-4 py-6 pb-28 space-y-6 max-w-md mx-auto text-text-primary">
        {/* Top Header & Status Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
              <Bot size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-text-primary tracking-tight">AI Autopilot</h1>
                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-gradient-to-r from-primary to-primary-dark text-white shadow-sm">
                  V5
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {isFree ? (
                  <span className="text-xs font-semibold text-primary">
                    Available on Plus & Pro
                  </span>
                ) : (
                  <>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        settings.status === 'active'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          settings.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                        }`}
                      />
                      {settings.status === 'active' ? 'Active' : 'Paused'}
                    </span>
                    <span className="text-text-muted text-xs">•</span>
                    <span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary uppercase">
                      {isPro ? 'Pro • Full Access' : 'Plus • Limited'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Controls: Pause / Resume only when NOT on Free */}
          {!isFree && (
            <div className="flex items-center">
              <button
                onClick={handleToggleStatus}
                className={`p-2.5 rounded-xl border transition-all ${
                  settings.status === 'active'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                }`}
                title={settings.status === 'active' ? 'Pause Autopilot' : 'Resume Autopilot'}
              >
                {settings.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
              </button>
            </div>
          )}
        </div>

        {/* Free Plan Upgrade Banner */}
        {isFree && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/15 to-purple-500/10 border border-primary/25 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center flex-shrink-0 shadow-md">
                  <Sparkles size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-text-primary block">
                    AI Autopilot is available on Plus & Pro
                  </span>
                  <span className="text-[11px] text-text-secondary leading-snug">
                    Let AI discover, qualify and reach out to the best opportunities for you.
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setUpgradeReason('Upgrade to let AI discover, qualify and reach out to opportunities for you.');
                  setShowUpgradeModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold shadow-sm hover:opacity-95 transition-opacity"
              >
                Upgrade to Plus
              </button>
              <button
                onClick={() => navigate('/membership')}
                className="px-3 py-1.5 rounded-xl bg-surface border border-border text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors"
              >
                View Plans
              </button>
            </div>
          </div>
        )}

        {/* Plus Active Status Banner */}
        {isPlus && (
          <div className="p-2.5 px-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 flex items-center gap-2">
            <ShieldCheck size={16} className="flex-shrink-0" />
            <span>Autopilot is running within your Plus limits.</span>
          </div>
        )}

        {/* Pro Active Status Banner */}
        {isPro && (
          <div className="p-2.5 px-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
            <Crown size={16} className="flex-shrink-0" />
            <span>Autopilot is running with full Pro automation.</span>
          </div>
        )}

        {/* Live Stats Cards Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-3 rounded-2xl border border-border bg-surface">
            <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Discovered</div>
            <div className="text-lg font-black text-text-primary mt-1">{stats.opportunitiesFound}</div>
            <div className="text-[10px] text-text-secondary mt-0.5">Total opportunities</div>
          </div>

          <div className="p-3 rounded-2xl border border-border bg-surface">
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Qualified</div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.qualifiedLeads}</div>
            <div className="text-[10px] text-text-secondary mt-0.5">Matching opportunities</div>
          </div>

          <div className="p-3 rounded-2xl border border-border bg-surface">
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider">Ready</div>
            <div className="text-lg font-black text-primary mt-1">{approvalQueue.length}</div>
            <div className="text-[10px] text-text-secondary mt-0.5">Proposals ready</div>
          </div>

          <div className="p-3 rounded-2xl border border-border bg-surface">
            <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Sent Today</div>
            <div className="text-lg font-black text-text-primary mt-1">
              {stats.sentToday}
              <span className="text-xs text-text-muted font-normal"> / {effectiveLimit}</span>
            </div>
            <div className="text-[10px] text-text-secondary mt-0.5">Applications sent today</div>
          </div>

          <div className="p-3 rounded-2xl border border-border bg-surface">
            <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">Replies</div>
            <div className="text-lg font-black text-purple-600 dark:text-purple-400 mt-1">{stats.repliesCount}</div>
            <div className="text-[10px] text-text-secondary mt-0.5">Responses received</div>
          </div>

          <div className="p-3 rounded-2xl border border-border bg-surface">
            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Meetings</div>
            <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">{stats.meetingsCount}</div>
            <div className="text-[10px] text-text-secondary mt-0.5">Intro calls</div>
          </div>
        </div>

        {/* Discovery Action Bar */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handleRunCycle}
            loading={isRunningCycle}
            icon={<Sparkles size={16} />}
          >
            Run Discovery & Qualification Cycle
          </Button>
        </div>

        {/* How Autopilot Works Section */}
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Bot size={14} />
              </div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                How Autopilot Works
              </h3>
            </div>
            <span className="text-[10px] text-text-muted">6-Step Intelligent Engine</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-surface-hover/50 border border-border/60">
              <div className="text-primary font-bold text-[10px]">01 Discover</div>
              <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
                Scans connected opportunity sources.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-hover/50 border border-border/60">
              <div className="text-primary font-bold text-[10px]">02 Qualify</div>
              <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
                Filters low-quality and irrelevant opportunities.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-hover/50 border border-border/60">
              <div className="text-primary font-bold text-[10px]">03 Match</div>
              <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
                Checks opportunities against your profile.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-hover/50 border border-border/60">
              <div className="text-primary font-bold text-[10px]">04 Personalize</div>
              <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
                Creates a tailored application.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-hover/50 border border-border/60">
              <div className="text-primary font-bold text-[10px]">05 Reach Out</div>
              <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
                Uses available contact channels within your plan.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-hover/50 border border-border/60">
              <div className="text-primary font-bold text-[10px]">06 Track</div>
              <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
                Tracks applications and replies.
              </p>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex border-b border-border gap-1 overflow-x-auto no-scrollbar">
          {TAB_OPTIONS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.id === 'approval' && approvalQueue.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary text-white font-bold">
                    {approvalQueue.length}
                  </span>
                )}
                {tab.id === 'replies' && replyLeads.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500 text-white font-bold">
                    {replyLeads.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: APPROVAL QUEUE */}
        {activeTab === 'approval' && (
          <div className="space-y-3.5">
            {/* Batch Action Toolbar */}
            {approvalQueue.length > 0 && (
              <div className="flex items-center justify-between p-2.5 bg-surface rounded-xl border border-border text-xs">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.size === approvalQueue.length && approvalQueue.length > 0}
                    onChange={handleSelectAllApproval}
                    className="rounded accent-primary w-4 h-4 cursor-pointer"
                  />
                  <span className="text-text-secondary font-medium">
                    {selectedLeadIds.size} of {approvalQueue.length} selected
                  </span>
                </div>

                {selectedLeadIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBatchDismiss}
                      className="px-2.5 py-1 text-text-muted hover:text-rose-500 transition-colors font-medium"
                    >
                      Dismiss
                    </button>
                    <Button variant="primary" size="sm" onClick={handleBatchApprove} icon={<Check size={14} />}>
                      Approve ({selectedLeadIds.size})
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Queue List */}
            {approvalQueue.length > 0 ? (
              <div className="space-y-3">
                {approvalQueue.map((lead) => {
                  const isSelected = selectedLeadIds.has(lead.id);
                  const isCooldown = lead.lastContactedAt && (Date.now() - new Date(lead.lastContactedAt).getTime()) < 3 * 86400000;

                  return (
                    <Card
                      key={lead.id}
                      className={`p-4 border transition-all ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border bg-surface'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectLead(lead.id)}
                          className="mt-1 rounded accent-primary w-4 h-4 cursor-pointer flex-shrink-0"
                        />

                        <div className="flex-1 min-w-0">
                          {/* Platform & Score Header */}
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-hover text-text-secondary border border-border">
                                {lead.platform}
                              </span>
                              <span className="text-xs font-semibold text-text-secondary truncate max-w-[150px]">
                                {lead.company || lead.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-xs font-bold text-primary">
                                {lead.matchScore}% Match
                              </span>
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                {lead.qualificationScore} Qual
                              </span>
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="text-sm font-bold text-text-primary line-clamp-1 leading-snug">
                            {lead.title}
                          </h3>

                          {/* Proposal Preview Snippet */}
                          {lead.outreachMessage && (
                            <div className="mt-2 p-2.5 bg-surface-hover/30 rounded-xl border border-border text-xs text-text-secondary">
                              <div className="font-semibold text-text-primary text-[11px] mb-0.5 truncate">
                                Subject: {lead.outreachMessage.subject || 'Creative Proposal'}
                              </div>
                              <p className="line-clamp-2 leading-relaxed text-[11px] text-text-muted">
                                {lead.outreachMessage.fullBody || lead.outreachMessage.opening}
                              </p>
                            </div>
                          )}

                          {/* Contact badges */}
                          <div className="flex items-center gap-3 mt-2.5 text-xs text-text-secondary">
                            {lead.email && (
                              <span className="flex items-center gap-1 text-[11px]">
                                <Mail size={12} className="text-primary" />
                                {lead.email}
                              </span>
                            )}
                            {lead.phone && (
                              <span className="flex items-center gap-1 text-[11px]">
                                <MessageCircle size={12} className="text-emerald-500" />
                                {lead.phone}
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-border">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedLeadForDetails(lead)}
                                className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-surface-hover transition-colors"
                              >
                                <Eye size={13} />
                                <span>Research</span>
                              </button>
                              <button
                                onClick={() => handleDismissLead(lead.id)}
                                className="text-xs text-text-muted hover:text-rose-500 py-1 px-2 rounded-lg hover:bg-surface-hover transition-colors"
                              >
                                Dismiss
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedLeadForComposer(lead)}
                                icon={<Edit3 size={13} />}
                              >
                                Edit
                              </Button>

                              <Button
                                variant="primary"
                                size="sm"
                                disabled={isCooldown}
                                onClick={() => handleQuickApprove(lead.id)}
                                icon={<Send size={13} />}
                              >
                                Approve
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 px-4 border border-dashed border-border rounded-2xl space-y-3 bg-surface">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="font-bold text-base text-text-primary">Approval Queue Clear</h3>
                <p className="text-xs text-text-secondary max-w-xs mx-auto">
                  No proposals waiting in the approval queue. The agent can discover more opportunities across your connected sources.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRunCycle}
                  loading={isRunningCycle}
                  icon={<Sparkles size={14} />}
                >
                  Discover New Opportunities
                </Button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PIPELINE */}
        {activeTab === 'pipeline' && (
          <div className="space-y-3.5">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'waiting_approval', label: 'In Queue' },
                { id: 'sent', label: 'Sent' },
                { id: 'replied', label: 'Replied' },
                { id: 'meeting', label: 'Meetings' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPipelineFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
                    pipelineFilter === f.id
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-surface text-text-secondary border border-border hover:bg-surface-hover'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Pipeline Leads List */}
            {pipelineLeads.length > 0 ? (
              <div className="space-y-2.5">
                {pipelineLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    className="p-3.5 border border-border bg-surface"
                    onClick={() => setSelectedLeadForDetails(lead)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-surface-hover text-text-secondary border border-border">
                            {lead.platform}
                          </span>
                          <span className="text-xs font-semibold text-text-secondary truncate">
                            {lead.company || lead.name}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-text-primary truncate">{lead.title}</h4>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
                          <span>Match: {lead.matchScore}%</span>
                          <span>•</span>
                          <span className="capitalize text-primary font-medium">Status: {lead.status?.replace('_', ' ')}</span>
                          {lead.lastContactedAt && (
                            <>
                              <span>•</span>
                              <span>Sent: {new Date(lead.lastContactedAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-text-muted flex-shrink-0 mt-2" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-text-secondary border border-dashed border-border rounded-2xl">
                No opportunities found in this pipeline filter.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REPLIES & INBOX */}
        {activeTab === 'replies' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Replies Inbox</h3>
                <p className="text-xs text-text-secondary">AI categorizes client responses and drafts strategic replies</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleSimulateReply} icon={<Sparkles size={13} />}>
                Simulate Demo Reply
              </Button>
            </div>

            {replyLeads.length > 0 ? (
              <div className="space-y-3.5">
                {replyLeads.map((lead) => {
                  const reply = lead.clientReply || {};
                  const intentColors = {
                    interested: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                    pricing_discussion: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                    portfolio_request: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                    not_interested: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                  };

                  const currentDraft = replyDrafts[lead.id] !== undefined ? replyDrafts[lead.id] : (reply.aiSuggestedReply || '');

                  return (
                    <Card key={lead.id} className="p-4 border border-border bg-surface space-y-3">
                      {/* Top bar */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                            {lead.name?.slice(0, 1) || 'C'}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-text-primary">{lead.name}</div>
                            <div className="text-[10px] text-text-muted">{lead.company} • {lead.platform}</div>
                          </div>
                        </div>

                        {reply.intent && (
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              intentColors[reply.intent] || 'bg-surface border-border text-text-secondary'
                            }`}
                          >
                            {reply.intent.replace('_', ' ')} ({reply.confidence || 90}%)
                          </span>
                        )}
                      </div>

                      {/* Client Message */}
                      <div className="p-3 bg-surface-hover/40 rounded-xl border border-border text-xs text-text-primary leading-relaxed">
                        <div className="text-[10px] font-bold text-text-muted uppercase mb-1">Incoming Client Message</div>
                        "{reply.text || 'Client responded to your outreach.'}"
                      </div>

                      {/* AI Reply Assistant Box */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-primary flex items-center gap-1">
                            <Sparkles size={12} />
                            AI Suggested Reply
                          </span>
                          <span className="text-[10px] text-text-muted">Editable</span>
                        </div>
                        <textarea
                          rows={4}
                          value={currentDraft}
                          onChange={(e) => setReplyDrafts({ ...replyDrafts, [lead.id]: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-border bg-surface text-text-primary text-xs leading-relaxed focus:outline-none focus:border-primary transition-colors resize-none"
                        />
                      </div>

                      {/* Reply Actions */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(currentDraft);
                            toast.success('Reply copied to clipboard!');
                          }}
                        >
                          Copy Reply
                        </Button>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSuggestMeeting(lead)}
                            icon={<Calendar size={13} />}
                          >
                            Suggest Meeting
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              if (lead.email) {
                                window.open(`mailto:${lead.email}?body=${encodeURIComponent(currentDraft)}`, '_blank');
                              } else if (lead.phone) {
                                window.open(`https://wa.me/${lead.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(currentDraft)}`, '_blank');
                              }
                              toast.success('Sent response!');
                            }}
                            icon={<Send size={13} />}
                          >
                            Send
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 px-4 border border-dashed border-border rounded-2xl space-y-3 bg-surface">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                  <Inbox size={24} />
                </div>
                <h3 className="font-bold text-base text-text-primary">No Active Replies Yet</h3>
                <p className="text-xs text-text-secondary max-w-xs mx-auto">
                  When clients reply to your proposals, the AI Reply Assistant will automatically classify their intent and prepare responses.
                </p>
                <Button variant="secondary" size="sm" onClick={handleSimulateReply} icon={<Sparkles size={14} />}>
                  Simulate Demo Client Reply
                </Button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ACTIVITY LOG */}
        {activeTab === 'activity' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Agent Audit Trail</h3>
                <p className="text-xs text-text-secondary">Transparent log of all discovery, qualification, and outreach actions</p>
              </div>
              <button
                onClick={() => {
                  refreshData();
                  toast.success('Activities refreshed.');
                }}
                className="p-2 text-text-secondary hover:text-text-primary transition-colors"
                title="Refresh Log"
              >
                <RefreshCw size={15} />
              </button>
            </div>

            {activities.length > 0 ? (
              <div className="space-y-2">
                {activities.map((act) => {
                  const statusColors = {
                    success: 'text-emerald-500 bg-emerald-500/10',
                    warning: 'text-amber-500 bg-amber-500/10',
                    error: 'text-rose-500 bg-rose-500/10',
                    info: 'text-primary bg-primary/10',
                  };

                  return (
                    <div
                      key={act.id}
                      className="p-3 rounded-xl border border-border bg-surface flex items-start gap-2.5 text-xs"
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          statusColors[act.status] || 'bg-surface-hover text-text-muted'
                        }`}
                      >
                        <Bot size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-text-primary">{act.action}</span>
                          <span className="text-[10px] text-text-muted">
                            {act.timestamp ? new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                          </span>
                        </div>
                        {act.leadName && (
                          <div className="text-[11px] font-medium text-text-secondary mt-0.5">
                            Target: {act.leadName}
                          </div>
                        )}
                        <p className="text-text-muted text-[11px] mt-0.5 leading-relaxed">{act.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-text-secondary border border-dashed border-border rounded-2xl">
                No activity recorded yet. Run a discovery cycle to start.
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        <AutopilotIntroAnimation
          isOpen={showIntro}
          onClose={handleCompleteIntro}
          onComplete={handleCompleteIntro}
        />

        <AutopilotSetupWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          onComplete={(newSettings) => {
            setSettings(newSettings);
            refreshData();
          }}
        />

        <LeadDetailsModal
          isOpen={!!selectedLeadForDetails}
          lead={selectedLeadForDetails}
          onClose={() => setSelectedLeadForDetails(null)}
          onOpenComposer={(lead) => setSelectedLeadForComposer(lead)}
          onDismiss={(leadId) => handleDismissLead(leadId)}
        />

        <OutreachComposerModal
          isOpen={!!selectedLeadForComposer}
          lead={selectedLeadForComposer}
          onClose={() => setSelectedLeadForComposer(null)}
          onSent={() => refreshData()}
        />

        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          title="AI Autopilot"
          subtitle="Available on Plus & Pro"
          headline="Automate Your Opportunities"
          message={upgradeReason || 'Upgrade to let AI discover, qualify and reach out to opportunities for you.'}
          primaryCtaText="Upgrade to Plus"
          onPrimaryCta={() => {
            setShowUpgradeModal(false);
            navigate('/membership');
          }}
          secondaryCtaText="View Plans"
          onSecondaryCta={() => {
            setShowUpgradeModal(false);
            navigate('/membership');
          }}
        />
      </div>
    </PageTransition>
  );
};

export default AutopilotDashboard;
