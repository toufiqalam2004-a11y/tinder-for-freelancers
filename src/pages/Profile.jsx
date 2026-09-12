import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, LogOut, FileText, ExternalLink, Briefcase, ShieldCheck, 
  DollarSign, MapPin, Sparkles, Award, TrendingUp, Layers, CheckCircle2,
  Palette, Sun, Moon, Laptop, Crown, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageTransition from '../components/PageTransition';
import Card from '../components/Card';
import Button from '../components/Button';
import { useProfile } from '../contexts/ProfileContext';
import { useSources } from '../contexts/SourcesContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ColorThemeCustomizer from '../components/ColorThemeCustomizer';
import { calculateProfileStrength } from '../services/proMatchEngine';
import { getFunnelAnalytics, getAutopilotStats, getWorkspaces } from '../data/storage.js';
import { subscriptionService } from '../services/subscriptionService';
import { usageService } from '../services/usageService';

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
  const { profile } = useProfile();
  const { sources } = useSources();
  const { logout } = useAuth();
  const { themeMode, setThemeMode } = useTheme();

  const [activeProfileTab, setActiveProfileTab] = useState('primary');
  const analytics = getFunnelAnalytics();
  const autopilotStats = getAutopilotStats();
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
  const skills = profile?.skills || [];
  const portfolios = profile?.portfolioLinks || (profile?.portfolioUrl ? [{ title: 'Main Portfolio', url: profile.portfolioUrl }] : []);

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
            className="text-xs px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
          >
            Edit Profile
          </button>
        </div>

        {/* Profile Header Card */}
        <Card className="flex flex-col items-center p-5 text-center bg-surface border border-border">
          <div className="gradient-primary rounded-full w-16 h-16 flex items-center justify-center shadow-md text-white font-extrabold text-2xl">
            {getInitials(profile?.name)}
          </div>
          <h2 className="text-lg font-bold mt-2.5 text-text-primary">{profile?.name || 'Freelancer'}</h2>
          
          <p className="text-xs font-semibold text-primary mt-0.5">
            {profile?.headline || `${profile?.primaryRole || 'Video Editor'} • ${profile?.specialization || 'YouTube Content'}`}
          </p>

          <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary">
            <span>{profile?.primaryRole || 'Video Editor'}</span>
            <span>•</span>
            <span>{profile?.yearsOfExperience || 3} Years Experience</span>
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
        </Card>

        {/* Membership & Quotas Card */}
        {(() => {
          const sub = subscriptionService.getSubscription();
          const plan = subscriptionService.getCurrentPlanDetails();
          const usage = usageService.getTodayUsage();
          const credits = usageService.getCreditsSummary();
          const dailyLimit = plan.limits.applicationsPerDay;
          const usedToday = usage.applicationsUsed || 0;

          return (
            <Card className="p-4 bg-surface border border-border shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Crown size={18} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <span>{plan.name} Membership</span>
                      {plan.badge && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary text-white">
                          {plan.badge}
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-text-secondary">
                      {sub.plan === 'free' ? 'Starter Plan' : 'Active Subscription'}
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
                  <span className="text-text-muted text-[11px]">Extra Credits:</span>
                  <div className="font-bold text-amber-500 mt-0.5">
                    {credits.activeCredits} available
                  </div>
                </div>
              </div>
            </Card>
          );
        })()}

        {/* Success Statistics Card */}
        <Card className="p-4 bg-surface border border-border">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-primary" /> Career Statistics
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-surface-hover/60 border border-border">
              <div className="text-base font-black text-text-primary">{analytics.appliedCount}</div>
              <div className="text-[10px] text-text-muted font-medium mt-0.5">Applications</div>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-hover/60 border border-border">
              <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {analytics.rates?.responseRate || 0}%
              </div>
              <div className="text-[10px] text-text-muted font-medium mt-0.5">Response Rate</div>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-hover/60 border border-border">
              <div className="text-base font-black text-primary">{autopilotStats.meetingsCount || 0}</div>
              <div className="text-[10px] text-text-muted font-medium mt-0.5">Meetings Booked</div>
            </div>
          </div>
        </Card>

        {/* Multi-Profile Selector */}
        <div className="p-3 bg-surface rounded-2xl border border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-primary" />
            <div>
              <div className="text-xs font-bold text-text-primary">Active Matching Profile</div>
              <div className="text-[10px] text-text-muted">Controls which jobs match in your feed</div>
            </div>
          </div>
          <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
            {profile?.primaryRole || 'Video Editor'}
          </span>
        </div>

        {/* Work & Rate Preferences */}
        <Card className="mt-4 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-1.5">
            <Briefcase size={14} className="text-primary" /> Career & Preferences
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-surface-hover border border-border">
              <span className="text-[10px] text-text-muted uppercase block">Experience</span>
              <span className="font-bold text-text-primary mt-0.5 block">
                {profile?.yearsOfExperience || 3} Years ({profile?.experience || 'Mid-Level'})
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-hover border border-border">
              <span className="text-[10px] text-text-muted uppercase block">Location Pref</span>
              <span className="font-bold text-emerald-500 mt-0.5 block capitalize">
                {profile?.remotePreference || 'Remote Only'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-hover border border-border">
              <span className="text-[10px] text-text-muted uppercase block">Min Target Rate</span>
              <span className="font-bold text-text-primary mt-0.5 block">
                ${profile?.expectedSalaryMin || 500} / project
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-hover border border-border">
              <span className="text-[10px] text-text-muted uppercase block">Availability</span>
              <span className="font-bold text-text-primary mt-0.5 block">
                {profile?.availability || 'Immediately'}
              </span>
            </div>
          </div>
        </Card>

        {/* Skills Profiler with Levels */}
        {skills.length > 0 && (
          <Card className="mt-4 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-1.5">
              <Sparkles size={14} className="text-primary" /> Verified Skills ({skills.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => {
                const name = typeof skill === 'string' ? skill : skill.name;
                const level = typeof skill === 'string' ? 'Advanced' : skill.level || 'Advanced';
                return (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-hover border border-border text-xs text-text-primary"
                  >
                    <span className="font-medium">{name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold">
                      {level}
                    </span>
                  </span>
                );
              })}
            </div>
          </Card>
        )}

        {/* Portfolio Showcase */}
        {portfolios.length > 0 && (
          <Card className="mt-4 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-1.5">
              <ExternalLink size={14} className="text-primary" /> Portfolios & Proof ({portfolios.length})
            </h3>
            <div className="space-y-2">
              {portfolios.map((port, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-surface-hover border border-border text-xs"
                >
                  <span className="font-semibold text-text-primary">{port.title || 'Portfolio Link'}</span>
                  <a
                    href={port.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <span>Visit</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* CV & Sources Info */}
        <Card className="mt-4 p-0 divide-y divide-border">
          <div className="px-4 py-3 flex justify-between items-center text-xs">
            <span className="text-text-muted font-medium">CV Document</span>
            <span className="font-semibold text-emerald-500">
              {profile?.cvUrl ? '✓ Verified (demo-cv.pdf)' : 'Not uploaded'}
            </span>
          </div>
          <div className="px-4 py-3 flex justify-between items-center text-xs">
            <span className="text-text-muted font-medium">Active Sources Connected</span>
            <span className="font-semibold text-text-primary">{sources.length} sources</span>
          </div>
        </Card>

        {/* Appearance & Theme Setting */}
        <Card className="mt-4 p-4 bg-surface border border-border">
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

        {/* Sign out */}
        <div className="mt-6">
          <Button variant="ghost" fullWidth onClick={handleLogout}>
            <LogOut size={16} className="mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </PageTransition>
  );
};

export default Profile;
