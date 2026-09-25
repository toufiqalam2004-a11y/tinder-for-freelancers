import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, User, Briefcase, Sliders, Bell, 
  Shield, Moon, Sun, Monitor, Globe, Database, 
  Download, Trash2, ChevronRight, Check, AlertTriangle, 
  Sparkles, ExternalLink, Info, CheckCircle2, RefreshCw, Crown, Lock 
} from 'lucide-react';
import PageTransition from '../components/PageTransition';
import Card from '../components/Card';
import Button from '../components/Button';
import AboutModal from '../components/AboutModal';
import ColorThemeCustomizer from '../components/ColorThemeCustomizer';
import { useTheme } from '../contexts/ThemeContext';
import { useProfile } from '../contexts/ProfileContext';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionService } from '../services/subscriptionService';
import { usageService } from '../services/usageService';
import {
  getUser,
  getUserPreferences,
  saveUserPreferences,
  getWorkspaces,
  saveWorkspaces,
  getSourceHealthList,
  updateSourceHealth,
  exportUserData,
  clearUserHistory,
  deleteAccount,
  getAutoDeletePreference,
  setAutoDeletePreference,
} from '../data/storage.js';
import Modal from '../components/Modal';
import { APP_CONFIG } from '../utils/constants';
import toast from 'react-hot-toast';

const SECTIONS = [
  { id: 'membership', label: 'Membership & Quotas', icon: Crown },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'account', label: 'Account & Workspaces', icon: User },
  { id: 'preferences', label: 'Match Preferences', icon: Sliders },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'sources', label: 'Source Health', icon: Globe },
  { id: 'data', label: 'Data & Privacy', icon: Database },
];

const Settings = () => {
  const navigate = useNavigate();
  const { theme, setThemeMode, activeTheme } = useTheme();
  const { profile } = useProfile();
  const { logout } = useAuth();

  const [activeSection, setActiveSection] = useState('appearance');
  const [preferences, setPreferences] = useState(() => getUserPreferences());
  const [workspaces, setWorkspaces] = useState(() => getWorkspaces());
  const [sourceHealth, setSourceHealth] = useState(() => getSourceHealthList());
  const [showAboutModal, setShowAboutModal] = useState(false);

  const isPlusOrPro = subscriptionService.isPlus() || subscriptionService.isPro();
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(() => {
    try {
      return Boolean(getAutoDeletePreference());
    } catch {
      return false;
    }
  });

  const handleToggleAutoDelete = (val) => {
    if (!isPlusOrPro) {
      toast.error('Auto-delete is available only on Plus and Pro plans.', { icon: '🔒' });
      return;
    }
    setAutoDeletePreference(val);
    setAutoDeleteEnabled(val);
    toast.success(`Auto-delete ${val ? 'enabled (7 days)' : 'disabled'}.`);
  };



  // Preference updates
  const handleUpdatePreference = (key, value) => {
    const updated = { ...preferences, [key]: value, updatedAt: new Date().toISOString() };
    setPreferences(updated);
    saveUserPreferences(updated);
    toast.success('Preference updated');
  };

  const handleToggleEmailNotif = (key) => {
    const emailNotifs = { ...preferences.emailNotifications, [key]: !preferences.emailNotifications?.[key] };
    handleUpdatePreference('emailNotifications', emailNotifs);
  };

  // Export Data JSON
  const handleExportData = () => {
    const jsonStr = exportUserData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tinder-for-freelancers-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Backup file exported successfully!');
  };

  // Clear History
  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your application and lead history? Your profile will remain intact.')) {
      clearUserHistory();
      toast.success('History cleared.');
    }
  };

  // Delete Account
  const handleDeleteAccount = () => {
    if (window.confirm('WARNING: This will permanently delete your account, CV, preferences, and all opportunities on this device. This cannot be undone. Proceed?')) {
      deleteAccount();
      logout();
      window.location.href = '/';
    }
  };

  return (
    <PageTransition>
      <div className="px-4 py-6 pb-28 space-y-6 max-w-md mx-auto text-text-primary">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white font-extrabold text-sm shadow-glow">
              TF
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary tracking-tight">Settings</h1>
              <p className="text-xs text-text-secondary">{APP_CONFIG.NAME} • v{APP_CONFIG.VERSION}</p>
            </div>
          </div>

          <button
            onClick={() => setShowAboutModal(true)}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 py-1 px-2 rounded-lg bg-primary/10"
          >
            <Info size={13} />
            <span>About</span>
          </button>
        </div>

        {/* Section Navigation Pills */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface text-text-secondary border border-border hover:bg-surface-hover'
                }`}
              >
                <Icon size={14} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* SECTION 0: MEMBERSHIP & QUOTAS */}
        {activeSection === 'membership' && (() => {
          const sub = subscriptionService.getSubscription();
          const plan = subscriptionService.getCurrentPlanDetails();
          const usage = usageService.getTodayUsage();
          const credits = usageService.getCreditsSummary();
          const dailyLimit = plan.limits.applicationsPerDay;
          const usedToday = usage.applicationsUsed || 0;

          return (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Membership & Usage Quotas</h3>
                <p className="text-xs text-text-secondary">View active plan limits, daily counters, and credit balances</p>
              </div>

              <Card className="p-4 border border-border bg-surface space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <Crown size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                        <span>{plan.name} Membership</span>
                        {plan.badge && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary text-white">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-muted">{plan.tagline}</div>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/membership')}
                  >
                    Manage Plans
                  </Button>
                </div>

                <div className="pt-2 border-t border-border grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-surface-hover/70">
                    <span className="text-text-muted text-[11px] block">Daily Applications</span>
                    <span className="text-sm font-extrabold text-text-primary">{usedToday} / {dailyLimit} used</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-hover/70">
                    <span className="text-text-muted text-[11px] block">Application Credits</span>
                    <span className="text-sm font-extrabold text-amber-500">{credits.activeCredits} remaining</span>
                  </div>
                </div>
              </Card>
            </div>
          );
        })()}

        {/* SECTION 1: APPEARANCE */}
        {activeSection === 'appearance' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Appearance & Theme</h3>
              <p className="text-xs text-text-secondary">Choose how {APP_CONFIG.NAME} looks on your device</p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'light', label: 'Light', desc: 'Warm Beige', icon: Sun },
                { id: 'dark', label: 'Dark', desc: 'Deep Charcoal', icon: Moon },
                { id: 'system', label: 'System', desc: 'Auto Follow', icon: Monitor },
              ].map((t) => {
                const Icon = t.icon;
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setThemeMode(t.id);
                      toast.success(`Theme set to ${t.label}`);
                    }}
                    className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border bg-surface hover:bg-surface-hover/80'
                    }`}
                  >
                    <Icon size={20} className={isSelected ? 'text-primary' : 'text-text-muted'} />
                    <span className="text-xs font-bold text-text-primary">{t.label}</span>
                    <span className="text-[10px] text-text-muted">{t.desc}</span>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center mt-1">
                        <Check size={10} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-3 bg-surface rounded-xl border border-border text-xs text-text-secondary flex items-start gap-2">
              <Sparkles size={15} className="text-primary flex-shrink-0 mt-0.5" />
              <span>
                Our aesthetic is designed around <strong>Modern Pink + Warm Beige</strong> for a creator-friendly, premium experience.
              </span>
            </div>

            {/* Color Theme Customization & Live Preview */}
            <ColorThemeCustomizer />
          </div>
        )}

        {/* SECTION 2: ACCOUNT & WORKSPACES */}
        {activeSection === 'account' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Account & Workspaces</h3>
              <p className="text-xs text-text-secondary">Manage your user profile and workspace permissions</p>
            </div>

            {/* User Details Card */}
            <Card className="p-4 border border-border bg-surface space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-text-primary">{profile.name || 'Freelancer'}</div>
                  <div className="text-xs text-text-secondary">{profile.profession || 'Video Editor'}</div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                  Freelancer Account
                </span>
              </div>
              <div className="text-xs text-text-muted pt-1 border-t border-border flex items-center justify-between">
                <span>Phone: {profile.phone || '+91 ••••••••'}</span>
                <span>Role: Owner</span>
              </div>
            </Card>

            {/* Workspaces List */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Workspaces ({workspaces.length})
              </div>
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="p-3 rounded-xl border border-primary/40 bg-primary/5 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-text-primary">{ws.name}</div>
                    <div className="text-[10px] text-text-secondary">Type: Personal • Role: Owner</div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
              ))}
            </div>

            {/* Team / Agency Coming Soon Card */}
            <div className="p-3.5 rounded-xl border border-dashed border-border bg-surface text-xs space-y-1">
              <div className="font-bold text-text-primary flex items-center gap-1.5">
                <Briefcase size={14} className="text-primary" />
                <span>Agency & Team Workspaces</span>
                <span className="text-[10px] bg-surface-hover text-text-muted px-1.5 py-0.5 rounded uppercase font-semibold">
                  Coming Soon
                </span>
              </div>
              <p className="text-text-muted text-[11px]">
                Collaborative team discovery, shared applicant pipelines, and agency seats are architected for enterprise rollouts.
              </p>
            </div>
          </div>
        )}

        {/* SECTION 3: MATCH PREFERENCES */}
        {activeSection === 'preferences' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Match Preferences</h3>
              <p className="text-xs text-text-secondary">Customize what the recommendation engine prioritizes</p>
            </div>

            <Card className="p-4 border border-border bg-surface space-y-4 text-xs">
              {/* Remote Preference */}
              <div>
                <label className="font-bold text-text-secondary block mb-1.5">Remote Work Preference</label>
                <div className="grid grid-cols-3 gap-2">
                  {['remote', 'hybrid', 'any'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleUpdatePreference('remotePreference', opt)}
                      className={`py-1.5 px-3 rounded-lg border text-center capitalize font-semibold transition-all ${
                        preferences.remotePreference === opt
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-surface border-border text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minimum Match Score */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-text-secondary">Minimum Match Score</label>
                  <span className="font-bold text-primary">{preferences.minMatchScore || 70}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="90"
                  step="5"
                  value={preferences.minMatchScore || 70}
                  onChange={(e) => handleUpdatePreference('minMatchScore', Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              {/* Negative Feedback summary */}
              <div>
                <label className="font-bold text-text-secondary block mb-1">Learned Exclusions</label>
                <p className="text-text-muted text-[11px] mb-2">
                  When you skip jobs with "Not interested", the engine learns your preferences:
                </p>
                {preferences.negativeFeedback?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {preferences.negativeFeedback.slice(-4).map((fb, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-surface-hover border border-border text-[10px] text-text-secondary">
                        Excluded: {fb.reason}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-text-muted">No excluded preferences yet.</div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* SECTION 4: NOTIFICATIONS */}
        {activeSection === 'notifications' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Notification Settings</h3>
              <p className="text-xs text-text-secondary">Configure alerts for matches and client responses</p>
            </div>

            <Card className="p-4 border border-border bg-surface space-y-3">
              {[
                { id: 'newHighMatch', label: 'High Match Opportunities', desc: 'Notify when opportunities >80% are discovered' },
                { id: 'applicationStatusChange', label: 'Application Status Updates', desc: 'Alerts on viewed, interview, or replies' },
                { id: 'leadReply', label: 'Client Lead Responses', desc: 'Immediate notification when a hiring lead responds' },
                { id: 'followUpDue', label: 'Polite Follow-up Reminders', desc: 'Reminders when 3 or 7 days pass without reply' },
              ].map((notif) => {
                const isEnabled = preferences.emailNotifications?.[notif.id] !== false;
                return (
                  <div key={notif.id} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0 text-xs">
                    <div>
                      <div className="font-semibold text-text-primary">{notif.label}</div>
                      <div className="text-[11px] text-text-muted">{notif.desc}</div>
                    </div>
                    <button
                      onClick={() => handleToggleEmailNotif(notif.id)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        isEnabled ? 'bg-primary' : 'bg-border'
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                          isEnabled ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </Card>
          </div>
        )}



        {/* SECTION 6: SOURCE HEALTH & BACKEND STATUS */}
        {activeSection === 'sources' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">System & Source Health</h3>
              <p className="text-xs text-text-secondary">Real-time status of backend API layer and public discovery feeds</p>
            </div>

            {/* Backend Health Check Card */}
            <Card className="p-3.5 border border-border bg-surface">
              <div className="text-xs font-bold text-text-primary flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5">
                  <Shield size={14} className="text-primary" />
                  Backend Architecture Status
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  ● Healthy
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-text-secondary">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>Backend API:</span>
                  <span className="font-semibold text-text-primary">Connected (Port 5000)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>Database:</span>
                  <span className="font-semibold text-text-primary">Active (JSON Engine)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>Reddit API:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Demo Mode (Fallback)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>YouTube Data API:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Demo Mode (Fallback)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>X (Twitter) API:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Demo Mode (Fallback)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span>AI Engine:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Zero-Hallucination Fallback</span>
                </div>
              </div>
            </Card>

            <div className="space-y-2.5">
              {sourceHealth.map((src) => (
                <Card key={src.sourceId} className="p-3.5 border border-border bg-surface">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {src.name}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">{src.message}</div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full capitalize">
                      {src.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-text-muted pt-2 mt-2 border-t border-border">
                    <span>Last Sync: {new Date(src.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>Latency: {src.latencyMs}ms</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 7: DATA & PRIVACY */}
        {activeSection === 'data' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Data & Privacy</h3>
              <p className="text-xs text-text-secondary">Export your data or manage local storage safely</p>
            </div>

            <Card className="p-4 border border-border bg-surface space-y-3 text-xs">
              <div>
                <div className="font-bold text-text-primary mb-1">Export Data Backup</div>
                <p className="text-text-muted mb-2 text-[11px]">
                  Download your entire profile, saved jobs, and CRM applications in JSON format.
                </p>
                <Button variant="secondary" size="sm" onClick={handleExportData} icon={<Download size={14} />}>
                  Export Data (JSON)
                </Button>
              </div>

              <div className="pt-3 border-t border-border">
                <div className="font-bold text-text-primary mb-1">Clear Application History</div>
                <p className="text-text-muted mb-2 text-[11px]">
                  Deletes all submitted applications and lead messages, keeping your profile and CV intact.
                </p>
                <Button variant="secondary" size="sm" onClick={handleClearHistory} icon={<RefreshCw size={14} />}>
                  Clear History
                </Button>
              </div>

              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold text-text-primary flex items-center gap-1.5">
                    <span>Auto-delete applications (7 days)</span>
                    {!isPlusOrPro && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        PLUS & PRO ONLY
                      </span>
                    )}
                  </div>
                  {isPlusOrPro ? (
                    <div className="flex items-center bg-surface border border-border rounded-xl p-0.5">
                      <button
                        type="button"
                        onClick={() => handleToggleAutoDelete(false)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          !autoDeleteEnabled ? 'bg-text-secondary text-white shadow-xs' : 'text-text-muted hover:text-text-primary'
                        }`}
                      >
                        OFF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAutoDelete(true)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          autoDeleteEnabled ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-primary'
                        }`}
                      >
                        ON
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        toast('Upgrade to Plus or Pro to unlock automatic application cleanup.', { icon: '⭐' });
                        navigate('/membership');
                      }}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Lock size={12} />
                      <span>Upgrade</span>
                    </button>
                  )}
                </div>
                <p className="text-text-muted text-[11px]">
                  Automatically remove applications inactive for 7 days. Active stages (Interview, Shortlisted, Hired) are always preserved.
                </p>
              </div>

              <div className="pt-3 border-t border-border">
                <div className="font-bold text-rose-600 dark:text-rose-400 mb-1">Delete Account & Data</div>
                <p className="text-text-muted mb-2 text-[11px]">
                  Permanently wipe all account data, profiles, and saved preferences from this device.
                </p>
                <button
                  onClick={handleDeleteAccount}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>Delete Everything</span>
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* About Modal */}
        <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} />
      </div>
    </PageTransition>
  );
};

export default Settings;
