import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './contexts/AuthContext';
import { useProfile } from './contexts/ProfileContext';
import BottomNav from './components/BottomNav';
import AppHeader from './components/AppHeader';
import Welcome from './pages/Welcome';
import OTPVerification from './pages/OTPVerification';
import ProfileSetup from './pages/ProfileSetup';
import Jobs from './pages/Jobs';
import JobDetails from './pages/JobDetails';
import ApplyJob from './pages/ApplyJob';
import ManualImport from './pages/ManualImport';
import ImportJobs from './pages/ImportJobs';
import AddFacebookGroup from './pages/AddFacebookGroup';
import Sources from './pages/Sources';
import SourceDetails from './pages/SourceDetails';
import Applications from './pages/Applications';
import ApplicationDetails from './pages/ApplicationDetails';
import Profile from './pages/Profile';
import AutopilotDashboard from './pages/AutopilotDashboard';
import Settings from './pages/Settings';
import Membership from './pages/Membership';
import OfflineBanner from './components/OfflineBanner';
import { rewardService } from './services/rewardService';

function App() {
  const { isAuthenticated } = useAuth();
  const { isProfileComplete } = useProfile();
  const location = useLocation();

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref') || params.get('referral');
      if (ref) {
        rewardService.setPendingReferralCode(ref);
      }
    } catch (e) {
      console.warn('Could not parse referral code from URL:', e);
    }
  }, []);

  const bottomNavPaths = ['/jobs', '/autopilot', '/sources', '/applications', '/profile'];
  const showBottomNav = bottomNavPaths.includes(location.pathname);

  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary transition-colors duration-200">
      <OfflineBanner />
      {/* Theme button in header (hidden on login/onboarding) */}
      <AppHeader />

      <div className="flex-1 w-full max-w-md mx-auto relative overflow-hidden">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={!isAuthenticated ? <Welcome /> : <Navigate to={isProfileComplete ? '/jobs' : '/profile-setup'} />} />
            <Route path="/verify-otp" element={!isAuthenticated ? <OTPVerification /> : <Navigate to={isProfileComplete ? '/jobs' : '/profile-setup'} />} />
            <Route path="/profile-setup" element={isAuthenticated ? <ProfileSetup /> : <Navigate to="/" />} />
            <Route path="/jobs" element={isAuthenticated ? <Jobs /> : <Navigate to="/" />} />
            <Route path="/autopilot" element={isAuthenticated ? <AutopilotDashboard /> : <Navigate to="/" />} />
            <Route path="/job/:id" element={isAuthenticated ? <JobDetails /> : <Navigate to="/" />} />
            <Route path="/apply/:jobId" element={isAuthenticated ? <ApplyJob /> : <Navigate to="/" />} />
            <Route path="/manual-import" element={isAuthenticated ? <ManualImport /> : <Navigate to="/" />} />
            <Route path="/import-jobs" element={isAuthenticated ? <ImportJobs /> : <Navigate to="/" />} />
            <Route path="/add-facebook-group" element={isAuthenticated ? <AddFacebookGroup /> : <Navigate to="/" />} />
            <Route path="/sources" element={isAuthenticated ? <Sources /> : <Navigate to="/" />} />
            <Route path="/source/:id" element={isAuthenticated ? <SourceDetails /> : <Navigate to="/" />} />
            <Route path="/applications" element={isAuthenticated ? <Applications /> : <Navigate to="/" />} />
            <Route path="/application/:id" element={isAuthenticated ? <ApplicationDetails /> : <Navigate to="/" />} />
            <Route path="/profile" element={isAuthenticated ? <Profile /> : <Navigate to="/" />} />
            <Route path="/membership" element={isAuthenticated ? <Membership /> : <Navigate to="/" />} />
            <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AnimatePresence>
      </div>

      {isAuthenticated && showBottomNav && <BottomNav />}
    </div>
  );
}

export default App;
