import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminLayout, { ADMIN_NAV_ITEMS } from './AdminLayout';
import AdminOverview from './AdminOverview';
import AdminUsers from './AdminUsers';
import AdminApplications from './AdminApplications';
import AdminOpportunities from './AdminOpportunities';
import AdminSources from './AdminSources';
import AdminAIAgent from './AdminAIAgent';
import AdminSubscriptions from './AdminSubscriptions';
import AdminAnalytics from './AdminAnalytics';
import AdminSettings from './AdminSettings';

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Derive current tab from URL path
  const getTabFromPath = () => {
    const path = location.pathname;
    if (path === '/admin') return 'overview';
    const match = ADMIN_NAV_ITEMS.find((item) => item.path === path);
    return match ? match.id : 'overview';
  };

  const currentTab = getTabFromPath();

  const handleTabChange = (tabId) => {
    const item = ADMIN_NAV_ITEMS.find((n) => n.id === tabId);
    if (item) {
      navigate(item.path);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  // Render view corresponding to current tab
  const renderView = () => {
    switch (currentTab) {
      case 'users':
        return <AdminUsers key={refreshKey} />;
      case 'applications':
        return <AdminApplications key={refreshKey} />;
      case 'opportunities':
        return <AdminOpportunities key={refreshKey} />;
      case 'sources':
        return <AdminSources key={refreshKey} />;
      case 'ai-agent':
        return <AdminAIAgent key={refreshKey} />;
      case 'subscriptions':
        return <AdminSubscriptions key={refreshKey} />;
      case 'analytics':
        return <AdminAnalytics key={refreshKey} />;
      case 'settings':
        return <AdminSettings key={refreshKey} onResetSuccess={handleRefresh} />;
      case 'overview':
      default:
        return <AdminOverview key={refreshKey} onNavigateTab={handleTabChange} />;
    }
  };

  return (
    <AdminLayout
      currentTab={currentTab}
      onTabChange={handleTabChange}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
    >
      {renderView()}
    </AdminLayout>
  );
}
