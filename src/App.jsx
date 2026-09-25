import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './contexts/AuthContext';
import { useProfile } from './contexts/ProfileContext';
import { AdminProvider } from './pages/admin/AdminContext';
import AdminRoute from './pages/admin/AdminRoute';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import BottomNav from './components/BottomNav';
import AppHeader from './components/AppHeader';
import Login from './pages/Login';
import Welcome from './pages/Welcome';
import Landing from './pages/Landing';
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

// Subdomain Detection for independent production deployments
// - yourdomain.com / localhost -> Full multi-experience router (Landing at /, User App at /login, Admin at /admin)
// - app.yourdomain.com          -> Directly routes root to User App (/jobs or /login)
// - admin.yourdomain.com        -> Directly routes root to Admin Dashboard (/admin or /admin/login)
export function getAppSubdomain() {
  if (typeof window === 'undefined') return null;
  const host = (window.location.hostname || '').toLowerCase();
  if (host.startsWith('admin.')) return 'admin';
  if (host.startsWith('app.')) return 'app';
  return null;
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  const { isProfileComplete } = useProfile();
  const location = useLocation();
  const subdomain = getAppSubdomain();

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

  const isAdmin = location.pathname.startsWith('/admin') || subdomain === 'admin';
  const isFullWidth = location.pathname === '/' || isAdmin;

  const bottomNavPaths = ['/jobs', '/autopilot', '/sources', '/applications', '/profile'];
  const showBottomNav = !isAdmin && bottomNavPaths.includes(location.pathname);

  // Dynamic root resolution based on subdomain
  const renderRoot = () => {
    if (subdomain === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    if (subdomain === 'app') {
      if (!isAuthenticated) return <Navigate to="/login" replace />;
      if (!isProfileComplete) return <Navigate to="/profile-setup" replace />;
      return <Navigate to="/jobs" replace />;
    }
    return <Landing />;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary transition-colors duration-200">
      <OfflineBanner />
      {/* Theme button in header (hidden on login/onboarding/admin) */}
      <AppHeader />

      <div className={`flex-1 w-full relative ${isFullWidth ? '' : 'max-w-md mx-auto overflow-hidden'}`}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            {/* 1. Public Landing Website / Subdomain Root */}
            <Route path="/" element={renderRoot()} />

            {/* 2. Private Admin Dashboard Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/*"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />

            {/* 3. User Authentication & Onboarding */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Login initialMode="signup" />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/verify-otp" element={<OTPVerification />} />
            <Route path="/profile-setup" element={isAuthenticated ? <ProfileSetup /> : <Navigate to="/login" replace />} />

            {/* 4. Authenticated User Application */}
            <Route path="/jobs" element={!isAuthenticated ? <Navigate to="/login" replace /> : (!isProfileComplete ? <Navigate to="/profile-setup" replace /> : <Jobs />)} />
            <Route path="/autopilot" element={!isAuthenticated ? <Navigate to="/login" replace /> : (!isProfileComplete ? <Navigate to="/profile-setup" replace /> : <AutopilotDashboard />)} />
            <Route path="/job/:id" element={!isAuthenticated ? <Navigate to="/login" replace /> : (!isProfileComplete ? <Navigate to="/profile-setup" replace /> : <JobDetails />)} />
            <Route path="/apply/:jobId" element={!isAuthenticated ? <Navigate to="/login" replace /> : (!isProfileComplete ? <Navigate to="/profile-setup" replace /> : <ApplyJob />)} />
            <Route path="/manual-import" element={!isAuthenticated ? <Navigate to="/login" replace /> : (!isProfileComplete ? <Navigate to="/profile-setup" replace /> : <ManualImport />)} />
            <Route path="/import-jobs" element={!isAuthenticated ? <Navigate to="/login" replace /> : (!isProfileComplete ? <Navigate to="/profile-setup" replace /> : <ImportJobs />)} />
            <Route path="/add-facebook-group" element={!isAuthenticated ? <Navigate to="/login" replace /> : (!isProfileComplete ? <Navigate to="/profile-setup" replace /> : <AddFacebookGroup />)} />
            <Route path="/sources" element={!isAuthenticated ? <Navigate to="/login" replace /> : (!isProfileComplete ? <Navigate to="/profile-setup" replace /> : <Sources />)} />
            <Route path="/source/:id" element={!isAuthenticated ? <Navigate to="/login" replace /> : (!isProfileComplete ? <Navigate to="/profile-setup" replace /> : <SourceDetails />)} />
            <Route path="/applications" element={!isAuthenticated ? <Navigate to="/login" replace /> : (!isProfileComplete ? <Navigate to="/profile-setup" replace /> : <Applications />)} />
            <Route path="/application/:id" element={!isAuthenticated ? <Navigate to="/login" replace /> : (!isProfileComplete ? <Navigate to="/profile-setup" replace /> : <ApplicationDetails />)} />
            <Route path="/profile" element={!isAuthenticated ? <Navigate to="/login" replace /> : (!isProfileComplete ? <Navigate to="/profile-setup" replace /> : <Profile />)} />
            <Route path="/membership" element={!isAuthenticated ? <Navigate to="/login" replace /> : (!isProfileComplete ? <Navigate to="/profile-setup" replace /> : <Membership />)} />
            <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </div>

      {isAuthenticated && showBottomNav && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <AdminProvider>
      <AppContent />
    </AdminProvider>
  );
}
