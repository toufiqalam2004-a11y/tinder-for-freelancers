import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, ShieldCheck, Crown, ChevronRight, Lock, Zap, Mail, MessageCircle, Palette, Sun, Moon, Laptop, Edit3, Camera
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageTransition from '../components/PageTransition';
import Card from '../components/Card';
import Button from '../components/Button';
import UpgradeModal from '../components/UpgradeModal';
import ProfilePhotoModal from '../components/ProfilePhotoModal.jsx';
import { useProfile } from '../contexts/ProfileContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ColorThemeCustomizer from '../components/ColorThemeCustomizer';
import { calculateProfileStrength } from '../services/proMatchEngine.js';
import { getWorkspaces, getOutreachPreferences, updateOutreachPreferences, getUserPhoto, saveUserPhoto, removeUserPhoto } from '../data/storage.js';
import { subscriptionService } from '../services/subscriptionService.js';
import { usageService } from '../services/usageService.js';
import { featureAccess } from '../services/featureAccessService.js';
import { outreachService } from '../services/outreach/outreachService.js';
import { normalizePlan, isProPlan } from '../utils/planUtils.js';
import RewardsSection from '../components/RewardsSection';
import { rewardService } from '../services/rewardService.js';

const THEME_OPTIONS = [
  {
    id: 'light',
    label: 'Light',
    symbol: '☀',
    icon: Sun,
    description: 'Warm Beige aesthetic for daytime focus',
  },
  {
    id: 'dark',
    label: 'Dark',
    symbol: '🌙',
    icon: Moon,
    description: 'Deep Charcoal aesthetic with vibrant pink accents',
  },
  {
    id: 'system',
    label: 'System Default',
    symbol: '⚙',
    icon: Laptop,
    description: 'Automatically follows your device or browser appearance',
  },
];

const THEME_LABELS = {
  light: 'Light',
  dark: 'Dark',
  system: 'System Default',
};

const Profile = () => {
  const navigate = useNavigate();
  const { profile, saveProfile } = useProfile();
  const { logout, profilePhoto, setProfilePhoto } = useAuth();
  const { themeMode, setThemeMode } = useTheme();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(() => subscriptionService.getSubscription()?.plan || 'free');
  const [isPro, setIsPro] = useState(() => featureAccess.isProEnabled());

  const userId = profile?.id || 'default_user';
  const currentPhoto = profilePhoto !== undefined ? profilePhoto : getUserPhoto(userId);

  const [outreachStatus, setOutreachStatus] = useState({
    emailConfigured: false,
    whatsAppConfigured: false,
    hasAnyProvider: false,
  });

  useEffect(() => {
    let isMounted = true;
    outreachService.getOutreachStatus().then((status) => {
      if (isMounted && status) {
        setOutreachStatus(status);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleSubChanged = (e) => {
      const newPlan = e.detail?.plan;
      setCurrentPlan(normalizePlan(newPlan));
      setIsPro(isProPlan(newPlan));
    };
    window.addEventListener('tf_subscription_changed', handleSubChanged);
    return () => window.removeEventListener('tf_subscription_changed', handleSubChanged);
  }, []);

  const [rewardCredits, setRewardCredits] = useState(() => rewardService.getRewardCredits());
  useEffect(() => {
    const handleRewardsChanged = () => {
      setRewardCredits(rewardService.getRewardCredits());
    };
    window.addEventListener('tf_rewards_changed', handleRewardsChanged);
    return () => window.removeEventListener('tf_rewards_changed', handleRewardsChanged);
  }, []);

  const currentOutreachPrefs = profile?.outreachPreferences || getOutreachPreferences();
  const [outreachPrefs, setOutreachPrefs] = useState(currentOutreachPrefs);

  const handleUpdateOutreach = (updates) => {
    if (!isPro) {
      setShowUpgradeModal(true);
      return;
    }
    const next = updateOutreachPreferences(updates);
    setOutreachPrefs(next);
    if (saveProfile) {
      saveProfile({ outreachPreferences: next });
    }
    toast.success('Outreach preferences updated!');
  };

  const workspaces = getWorkspaces();
  const currentWorkspace = workspaces[0] || { name: 'Personal Workspace' };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getInitials = (name) => {
    if (!name) return 'TF';
    return name.charAt(0).toUpperCase();
  };

  const strength = calculateProfileStrength(profile || {});

  return (
    <PageTransition>
      <div className="px-5 py-6 pb-28 max-w-md mx-auto space-y-4 text-text-primary">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-text-primary tracking-tight">Freelancer Profile</h1>
            <div className="flex items-center gap-1.5 text-xs text-text-muted mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{currentWorkspace.name}</span>
              <span>•</span>
              <span className="capitalize">{profile?.accountType || 'Freelancer'}</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/profile-setup')}
            className="text-xs px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Edit3 size={13} />
            <span>Edit Profile</span>
          </button>
        </div>

        {/* Profile Header Card */}
        <Card className="flex flex-col items-center p-5 text-center bg-surface border border-border">
          <div className="relative">
            <div
              onClick={() => setShowPhotoModal(true)}
              className="rounded-full w-16 h-16 flex items-center justify-center shadow-md overflow-hidden cursor-pointer group border-2 border-primary/20"
              title="Click to change profile photo"
            >
              {currentPhoto && !imgError ? (
                <img
                  src={currentPhoto}
                  alt={profile?.name || 'Freelancer'}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="gradient-primary w-full h-full flex items-center justify-center text-white font-extrabold text-2xl">
                  {getInitials(profile?.name)}
                </div>
              )}
            </div>

            {/* Small camera overlay button */}
            <button
              type="button"
              onClick={() => setShowPhotoModal(true)}
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-primary text-white hover:bg-primary-dark shadow-md border-2 border-surface transition-transform hover:scale-110"
              title="Change profile photo"
              aria-label="Change profile photo"
            >
              <Camera size={12} />
            </button>
          </div>
          <h2 className="text-lg font-bold mt-2.5 text-text-primary">{profile?.name || 'Freelancer'}</h2>
          
          <p className="text-xs font-semibold text-primary mt-0.5">
            {profile?.headline || `${profile?.primaryRole || 'Video Editor'} • ${profile?.specialization || 'YouTube Content'}`}
          </p>

          <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary">
            <span>{profile?.primaryRole || profile?.profession || 'Video Editor'}</span>
            <span>•</span>
            <span>{profile?.yearsOfExperience !== undefined ? profile.yearsOfExperience : 3} Years Experience</span>
          </div>

          {profile?.bio && (
            <p className="text-xs text-text-muted mt-2.5 max-w-xs leading-relaxed italic bg-surface-hover/70 px-3 py-2 rounded-xl border border-border">
              "{profile.bio}"
            </p>
          )}

          {/* Profile Strength Widget */}
          <div className="w-full mt-3.5 pt-3.5 border-t border-border">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-text-secondary flex items-center gap-1">
                <ShieldCheck size={14} className="text-primary" /> Profile Strength
              </span>
              <span className="font-bold text-primary">{strength.score}%</span>
            </div>
            <div className="w-full bg-surface-hover h-2 rounded-full overflow-hidden">
              <div
                className="h-full gradient-primary rounded-full transition-all duration-500"
                style={{ width: `${strength.score}%` }}
              />
            </div>
          </div>

          {/* Direct Edit Button inside card */}
          <Button
            variant="outline"
            size="sm"
            fullWidth
            className="mt-3.5 text-xs"
            onClick={() => navigate('/profile-setup')}
            icon={<Edit3 size={13} />}
          >
            Edit Profile
          </Button>
        </Card>

        {/* Membership & Quotas Card */}
        {(() => {
          const sub = subscriptionService.getSubscription();
          const plan = subscriptionService.getPlanDetails(currentPlan) || subscriptionService.getCurrentPlanDetails();
          const usage = usageService.getTodayUsage();
          const credits = usageService.getCreditsSummary();
          const dailyLimit = plan?.limits?.applicationsPerDay ?? 5;
          const usedToday = usage?.applicationsUsed || 0;

          return (
            <Card className="p-4 bg-surface border border-border shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Crown size={18} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <span>{plan?.name || 'Free'} Membership</span>
                      {plan?.badge && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary text-white">
                          {plan.badge}
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-text-secondary">
                      {normalizePlan(sub?.plan || currentPlan) === 'free' ? 'Starter Plan' : 'Active Subscription'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/membership')}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <span>Manage</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-hover/70 border border-border flex items-center justify-between text-xs">
                <div>
                  <span className="text-text-muted text-[11px]">Today's Applications:</span>
                  <div className="font-bold text-text-primary mt-0.5">
                    {usedToday} / {dailyLimit} used
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-text-muted text-[11px]">Total Extra Credits:</span>
                  <div className="font-bold text-amber-500 mt-0.5">
                    {credits.activeCredits + rewardCredits} available
                  </div>
                </div>
              </div>
            </Card>
          );
        })()}

        {/* 3. REWARDS & REFERRALS */}
        <RewardsSection />

        {/* 4. QUICK APPLY */}
        <Card className="p-4 bg-surface border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Zap size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                  <span>Quick Apply</span>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white shadow-sm">
                    PRO
                  </span>
                </h3>
                <p className="text-[11px] text-text-muted">
                  Swipe once and let AI handle the application and outreach.
                </p>
              </div>
            </div>

            {isPro ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!outreachPrefs.quickApplyEnabled}
                  onChange={(e) => handleUpdateOutreach({ quickApplyEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            ) : (
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-surface-hover border border-border text-text-muted hover:text-primary flex items-center gap-1"
              >
                <Lock size={12} />
                <span>Locked</span>
              </button>
            )}
          </div>

          {!isPro ? (
            /* Locked upgrade prompt for Free & Plus */
            <div className="mt-3 p-3.5 rounded-xl bg-surface-hover/70 border border-border/80 text-center space-y-2">
              <div className="flex items-center justify-center gap-1 text-xs font-bold text-text-primary">
                <Lock size={14} className="text-amber-500" />
                <span>PRO Feature</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Free and Plus users review applications before sending. Upgrade to <strong>PRO</strong> to enable 1-swipe AI Auto Outreach directly to clients via Email and WhatsApp.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-1"
                onClick={() => setShowUpgradeModal(true)}
                icon={<Crown size={14} />}
              >
                Upgrade to PRO
              </Button>
            </div>
          ) : (
            /* Pro Configuration Controls */
            <div className="mt-3 space-y-3 pt-2 border-t border-border">
              {/* Channel selector */}
              <div>
                <span className="text-[11px] font-semibold text-text-secondary block mb-1.5">
                  Outreach Channel Preference:
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {[
                    { id: 'both', label: 'Email & WhatsApp' },
                    { id: 'email', label: 'Email Only' },
                    { id: 'whatsapp', label: 'WhatsApp Only' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleUpdateOutreach({ contactPreference: opt.id })}
                      className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all ${
                        outreachPrefs.contactPreference === opt.id
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-surface-hover border-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider Config Status Callout */}
              <div className="p-2.5 rounded-xl bg-surface-hover border border-border text-[11px] space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-text-secondary">
                  <span>Outreach Adapters Live Status:</span>
                  <span className="text-[10px] text-text-muted">
                    {outreachStatus.emailConfigured || outreachStatus.whatsAppConfigured
                      ? 'Live Providers'
                      : outreachStatus.demoOutreachEnabled
                      ? 'Demo Simulation'
                      : 'Not Configured'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <Mail size={12} className="text-primary" /> Email Adapter
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      outreachStatus.emailConfigured
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : outreachStatus.demoOutreachEnabled
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-surface text-text-muted border border-border'
                    }`}
                  >
                    {outreachStatus.emailConfigured
                      ? 'Email Ready'
                      : outreachStatus.demoOutreachEnabled
                      ? 'Demo Outreach Active'
                      : 'Not Configured'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <MessageCircle size={12} className="text-emerald-500" /> WhatsApp Adapter
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      outreachStatus.whatsAppConfigured
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : outreachStatus.demoOutreachEnabled
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-surface text-text-muted border border-border'
                    }`}
                  >
                    {outreachStatus.whatsAppConfigured
                      ? 'WhatsApp Ready'
                      : outreachStatus.demoOutreachEnabled
                      ? 'Demo Outreach Active'
                      : 'Not Configured'}
                  </span>
                </div>
                <p className="text-[10px] text-text-muted leading-normal pt-1 border-t border-border/60">
                  {outreachStatus.demoOutreachEnabled ? (
                    <span>🧪 <strong>Demo Outreach Active:</strong> 1-swipe Quick Apply simulates outreach internally and marks applications as DEMO without sending real external emails or WhatsApp messages.</span>
                  ) : (
                    <span>⚠️ Note: Real automated outreach requires active API credentials. If unconfigured or client has no direct contact, swiping right seamlessly falls back to the manual proposal review page so no job is lost or falsely marked sent.</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* 5. APPEARANCE */}
        <Card className="p-4 bg-surface border border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <Palette size={14} className="text-primary" /> Appearance
            </h3>
            <span className="text-[11px] font-medium text-text-muted">
              Current: <strong className="text-primary font-bold">{THEME_LABELS[themeMode] || 'System Default'}</strong>
            </span>
          </div>

          <div className="mb-3">
            <h4 className="text-xs font-bold text-text-primary">Theme</h4>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Choose how Tinder for Freelancers looks.
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="Theme selection"
            className="space-y-2"
          >
            {THEME_OPTIONS.map((opt) => {
              const isSelected = themeMode === opt.id;
              const Icon = opt.icon;

              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => {
                    setThemeMode(opt.id);
                    toast.success(`Theme set to ${opt.label}`);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border bg-surface-hover/60 hover:bg-surface-hover hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-surface border border-border text-text-muted'
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                        <span aria-hidden="true">{opt.symbol}</span>
                        <span>{opt.label}</span>
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {opt.description}
                      </div>
                    </div>
                  </div>

                  {/* Accessible Radio Circle Indicator */}
                  <div
                    aria-hidden="true"
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      isSelected ? 'border-primary bg-primary' : 'border-border bg-surface'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Color Theme Customization & Live Preview */}
          <ColorThemeCustomizer />
        </Card>

        {/* 6. SIGN OUT */}
        <div className="mt-6">
          <Button variant="ghost" fullWidth onClick={handleLogout}>
            <LogOut size={16} className="mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Upgrade Modal */}
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          title="PRO Quick Apply Feature"
          message="Quick Apply & Auto Outreach is an exclusive PRO membership feature. Upgrade to PRO to enable automated 1-swipe job applications!"
          highlightPlan="pro"
        />

        {/* Profile Photo Modal */}
        <ProfilePhotoModal
          isOpen={showPhotoModal}
          onClose={() => setShowPhotoModal(false)}
          currentPhoto={currentPhoto}
          userInitial={getInitials(profile?.name)}
          userName={profile?.name || 'Freelancer'}
          onSave={(newPhoto) => {
            if (setProfilePhoto) setProfilePhoto(newPhoto);
            saveUserPhoto(userId, newPhoto);
            setImgError(false);
          }}
          onRemove={() => {
            if (setProfilePhoto) setProfilePhoto(null);
            removeUserPhoto(userId);
            setImgError(false);
          }}
        />
      </div>
    </PageTransition>
  );
};

export default Profile;
