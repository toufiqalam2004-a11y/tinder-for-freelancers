import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Search, Settings, Crown, Briefcase } from 'lucide-react';
import ThemeSelector from './ThemeSelector';
import NotificationsModal from './NotificationsModal';
import GlobalSearchModal from './GlobalSearchModal';
import { getNotifications } from '../data/storage.js';
import { subscriptionService } from '../services/subscriptionService';
import { APP_CONFIG } from '../utils/constants';

export default function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const planDetails = subscriptionService.getCurrentPlanDetails();

  const refreshUnread = () => {
    const notifs = getNotifications();
    setUnreadCount(notifs.filter((n) => !n.read).length);
  };

  useEffect(() => {
    refreshUnread();
    const interval = setInterval(refreshUnread, 15000);
    window.addEventListener('focus', refreshUnread);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshUnread);
    };
  }, []);

  // Starting/onboarding/login/landing/admin routes where in-app header must NOT be shown
  const onboardingPaths = ['/', '/login', '/signup', '/welcome', '/verify-otp', '/profile-setup'];
  const isOnboarding = onboardingPaths.includes(location.pathname) || location.pathname.startsWith('/admin');

  if (isOnboarding) {
    return null;
  }

  // Check if we are on a primary tab screen
  const isRootTab = ['/jobs', '/autopilot', '/sources', '/applications', '/profile', '/settings'].includes(location.pathname);

  return (
    <>
      <header className="sticky top-0 z-40 w-full max-w-md mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between bg-surface/85 backdrop-blur-md border-b border-border transition-colors">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-1 sm:mr-2">
          {!isRootTab ? (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors py-1 px-1.5 -ml-1 rounded-lg hover:bg-surface-hover flex-shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft size={17} />
              <span>Back</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/jobs')}
              className="flex items-center gap-1.5 sm:gap-2 text-left group min-w-0"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-[#E11D48] to-[#F43F6E] p-0.5 shadow-md shadow-rose-900/30 group-hover:scale-105 transition-transform flex-shrink-0">
                <div className="w-full h-full bg-[#141212] rounded-[5px] sm:rounded-[6px] flex items-center justify-center">
                  <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F43F6E]" />
                </div>
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <span className="font-extrabold text-xs sm:text-sm text-text-primary tracking-tight inline-flex items-center gap-1.5 whitespace-nowrap leading-none max-w-full">
                  <span className="truncate">Tinder for Freelancers</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 leading-none flex-shrink-0">
                    Beta
                  </span>
                </span>
                <span className="text-[9px] text-text-muted font-medium tracking-wide block mt-0.5 truncate">
                  Swipe. Match. Get Hired.
                </span>
              </div>
            </button>
          )}
        </div>

        {/* Action icons: Search, Notifications, Settings, Theme */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          {/* Global Search */}
          <button
            onClick={() => setShowSearch(true)}
            className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            title="Search (Jobs, Companies, Applications)"
            aria-label="Search"
          >
            <Search size={16} />
          </button>

          {/* Notifications */}
          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[15px] h-3.5 px-1 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Membership / Plan Badge */}
          <button
            onClick={() => navigate('/membership')}
            className={`px-1.5 sm:px-2 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              location.pathname === '/membership'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
            title="Membership & Quotas"
            aria-label="Membership"
          >
            <Crown size={14} className="flex-shrink-0" />
            <span className="capitalize hidden min-[390px]:inline">{planDetails.name}</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => navigate('/settings')}
            className={`p-1.5 rounded-xl transition-colors ${
              location.pathname === '/settings'
                ? 'text-primary bg-primary/10'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>

          <ThemeSelector />
        </div>
      </header>

      <NotificationsModal
        isOpen={showNotifications}
        onClose={() => {
          setShowNotifications(false);
          refreshUnread();
        }}
        onRefresh={refreshUnread}
      />

      <GlobalSearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
      />
    </>
  );
}

