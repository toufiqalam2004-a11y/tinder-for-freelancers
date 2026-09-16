import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, Play, Pause, CheckCircle2, Send, Clock, Sparkles, Loader2
} from 'lucide-react';
import PageTransition from '../components/PageTransition';
import { AutopilotPreviewAnimation } from '../components/AutopilotIntroAnimation';
import AutopilotDetailModal from '../components/AutopilotDetailModal';
import { subscriptionService } from '../services/subscriptionService.js';
import { useProfile } from '../contexts/ProfileContext';
import {
  getUser,
  getLeads,
  getAutopilotSettings,
  saveAutopilotSettings,
  logAgentActivity,
} from '../data/storage.js';
import { createAgentActivity } from '../data/models.js';

const AutopilotDashboard = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const user = getUser();
  const userId = user?.id || 'default_user';

  // Live Subscription State
  const [subState, setSubState] = useState(() => subscriptionService.getSubscription());
  const isPro = subscriptionService.isPro();
  const isPlus = subscriptionService.isPlus();
  const isFree = subscriptionService.isFree();

  // Settings & Storage Data
  const [settings, setSettings] = useState(() => getAutopilotSettings());
  const [leads, setLeads] = useState(() => getLeads());
  const [selectedLead, setSelectedLead] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const refreshData = useCallback(() => {
    setSubState(subscriptionService.getSubscription());
    setSettings(getAutopilotSettings());
    setLeads(getLeads());
  }, []);

  useEffect(() => {
    refreshData();

    const handleSubChange = (e) => {
      if (e.detail) {
        setSubState(e.detail);
      } else {
        refreshData();
      }
    };

    window.addEventListener('tf_subscription_changed', handleSubChange);
    window.addEventListener('storage', refreshData);
    return () => {
      window.removeEventListener('tf_subscription_changed', handleSubChange);
      window.removeEventListener('storage', refreshData);
    };
  }, [refreshData]);

  // Primary ON / OFF Toggle for PRO users
  const handleToggleStatus = () => {
    if (!isPro) return;

    const isCurrentlyActive = settings.status === 'active';
    const newStatus = isCurrentlyActive ? 'paused' : 'active';
    const updated = { ...settings, status: newStatus, updatedAt: new Date().toISOString() };
    saveAutopilotSettings(updated);
    setSettings(updated);

    logAgentActivity(
      createAgentActivity({
        action: newStatus === 'active' ? 'Autopilot Resumed' : 'Autopilot Paused',
        detail: newStatus === 'active' ? 'Autopilot is active.' : 'Autopilot is paused.',
        status: newStatus === 'active' ? 'success' : 'warning',
      })
    );

    refreshData();
  };

  const handleCardClick = (lead) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };

  // Filter applications sent by Autopilot for "WHERE THE AUTOPILOT APPLIED"
  const appliedLeads = leads.filter((l) => ['sent', 'applied', 'replied', 'meeting'].includes(l.status));
  const isAutopilotOn = settings.status === 'active';

  return (
    <PageTransition>
      <div className="px-4 py-6 pb-28 space-y-6 max-w-md mx-auto text-text-primary">
        {/* Top Header & Primary ON/OFF Control */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm relative ${
              isAutopilotOn ? 'ring-2 ring-emerald-500/30' : ''
            }`}>
              <Bot size={22} className={isAutopilotOn ? 'animate-bounce' : ''} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary tracking-tight">AI AUTOPILOT</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {isPro && (
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      isAutopilotOn
                        ? 'text-emerald-500'
                        : 'text-amber-500'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isAutopilotOn ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    {isAutopilotOn ? 'Autopilot is active.' : 'Autopilot is paused.'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Primary ON / OFF Toggle for PRO users */}
          {isPro && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleStatus}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all ${
                  isAutopilotOn
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                {isAutopilotOn ? (
                  <>
                    <Pause size={14} /> ON
                  </>
                ) : (
                  <>
                    <Play size={14} /> OFF
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 1. FREE / PLUS PLAN PROMOTIONAL VIEW */}
        {!isPro && (
          <div className="space-y-5">
            <div className="p-5 rounded-3xl bg-surface border border-border space-y-4 shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-text-primary tracking-tight">AI AUTOPILOT</h2>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  "Let AI find and reach out to the right opportunities for you."
                </p>
              </div>

              {/* Visual Product Animation */}
              <AutopilotPreviewAnimation interactive={false} />

              <p className="text-xs text-text-secondary leading-relaxed">
                Autopilot is a Pro feature.
              </p>

              <button
                onClick={() => navigate('/membership')}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-md hover:opacity-95 transition-all text-center"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        )}

        {/* 2. PRO PLAN DASHBOARD (CONTAINING ONLY "WHERE THE AUTOPILOT APPLIED") */}
        {isPro && (
          <div className="space-y-5">
            {/* LIVE SCANNING INDICATOR (WHEN ON) */}
            {isAutopilotOn && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Scanning opportunities...</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-500/80 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Cloud Backend Active
                </span>
              </motion.div>
            )}

            {/* SECTION: WHERE THE AUTOPILOT APPLIED */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  {/* Animated Send Arrow Icon when ON */}
                  <motion.div
                    animate={isAutopilotOn ? { x: [0, 3, 0] } : { x: 0 }}
                    transition={isAutopilotOn ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' } : {}}
                    className="inline-flex"
                  >
                    <Send size={13} className={isAutopilotOn ? 'text-emerald-500' : 'text-primary'} />
                  </motion.div>
                  <span>WHERE THE AUTOPILOT APPLIED</span>
                </h2>
                <span className="text-xs font-bold text-text-secondary bg-surface px-2 py-0.5 rounded-full border border-border">
                  {appliedLeads.length}
                </span>
              </div>

              {appliedLeads.length === 0 ? (
                <div className="p-6 rounded-2xl bg-surface border border-border text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Send size={18} />
                  </div>
                  <p className="text-xs font-semibold text-text-primary">No applications yet. Autopilot is looking for relevant opportunities.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {appliedLeads.map((lead) => (
                    <motion.div
                      key={lead.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      onClick={() => handleCardClick(lead)}
                      role="button"
                      tabIndex={0}
                      className="p-3.5 rounded-2xl bg-surface border border-border hover:border-primary/40 transition-all flex items-center justify-between cursor-pointer group active:scale-[0.99] shadow-sm hover:shadow"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                            {lead.jobTitle || lead.title || 'Freelance Project'}
                          </h3>
                          <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                            {lead.source || lead.channel || 'Reddit'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                          <span>Client: {lead.clientName || lead.company || 'Client'}</span>
                          <span>•</span>
                          <span>Action: {lead.action || 'Outreach Sent'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                          <span>Channel: {lead.channel || 'Email'}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {lead.appliedAt || lead.date || 'Recently'}
                          </span>
                        </div>
                      </div>
                      <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* APPLICATION DETAIL DRILL-DOWN MODAL */}
        <AutopilotDetailModal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          lead={selectedLead}
          profile={profile}
        />
      </div>
    </PageTransition>
  );
};

export default AutopilotDashboard;
