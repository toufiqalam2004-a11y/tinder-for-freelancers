import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Briefcase,
  Globe,
  Bot,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useAdmin } from './AdminContext';

export const ADMIN_NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/admin' },
  { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
  { id: 'applications', label: 'Applications', icon: FileText, path: '/admin/applications' },
  { id: 'opportunities', label: 'Opportunities', icon: Briefcase, path: '/admin/opportunities' },
  { id: 'sources', label: 'Sources', icon: Globe, path: '/admin/sources' },
  { id: 'ai-agent', label: 'AI Agent', icon: Bot, path: '/admin/ai-agent' },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard, path: '/admin/subscriptions' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
];

export default function AdminLayout({ children, currentTab, onTabChange, onRefresh, isRefreshing }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { adminUser, logout } = useAdmin();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  // Determine active item from path or currentTab prop
  const getActiveTab = () => {
    if (currentTab) return currentTab;
    const path = location.pathname;
    if (path === '/admin') return 'overview';
    const match = ADMIN_NAV_ITEMS.find((item) => item.path === path);
    return match ? match.id : 'overview';
  };

  const activeTab = getActiveTab();

  const handleNavClick = (item) => {
    setMobileOpen(false);
    if (onTabChange) {
      onTabChange(item.id);
    }
    navigate(item.path);
  };

  return (
    <div className="min-h-screen bg-[#141212] text-[#FAF7F2] font-sans flex flex-col md:flex-row selection:bg-rose-500/30 selection:text-rose-200">
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1A1818] border-b border-neutral-800 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#E11D48] to-[#F43F6E] p-0.5 flex items-center justify-center">
            <div className="w-full h-full bg-[#141212] rounded-[6px] flex items-center justify-center">
              <Briefcase className="w-3.5 h-3.5 text-[#F43F6E]" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm text-white">Admin Console</span>
            <span className="text-[10px] text-neutral-400">Tinder for Freelancers</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={`p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white ${
                isRefreshing ? 'animate-spin text-rose-400' : ''
              }`}
              title="Refresh Data"
              aria-label="Refresh Data"
            >
              <RefreshCw size={16} />
            </button>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white"
            aria-label="Toggle Navigation Drawer"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Over Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar: Desktop + Mobile Drawer */}
      <aside
        className={`fixed md:sticky top-0 h-screen bg-[#181616] border-r border-neutral-800/90 z-50 transition-all duration-300 flex flex-col justify-between ${
          mobileOpen ? 'left-0 w-64' : '-left-64 md:left-0'
        } ${collapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        {/* Sidebar Header */}
        <div>
          <div className="h-16 border-b border-neutral-800/80 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#E11D48] to-[#F43F6E] p-0.5 flex-shrink-0 shadow-md shadow-rose-950/40">
                <div className="w-full h-full bg-[#141212] rounded-[6px] flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-[#F43F6E]" />
                </div>
              </div>
              {!collapsed && (
                <div className="flex flex-col whitespace-nowrap">
                  <span className="font-extrabold text-sm text-white tracking-tight">Admin Console</span>
                  <span className="text-[10px] text-neutral-400 -mt-0.5">Tinder for Freelancers</span>
                </div>
              )}
            </div>

            {/* Desktop collapse toggle button */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex p-1.5 rounded-lg bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-170px)] no-scrollbar">
            {ADMIN_NAV_ITEMS.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300 shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <IconComponent
                    size={17}
                    className={`flex-shrink-0 ${
                      isActive ? 'text-rose-400' : 'text-neutral-400 group-hover:text-white'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Admin Profile & Logout */}
        <div className="p-3 border-t border-neutral-800/80 bg-[#151313]">
          <div className={`flex items-center gap-2.5 mb-2.5 px-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-bold text-rose-300 flex-shrink-0">
              <ShieldCheck size={14} />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-white truncate">
                  {adminUser?.name || 'Administrator'}
                </span>
                <span className="text-[10px] text-emerald-400 font-medium">Session Active</span>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all ${
              collapsed ? 'justify-center' : ''
            }`}
            title="Log out"
          >
            <LogOut size={15} className="flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-[#141212] overflow-y-auto">
        {/* Desktop Top Header Bar */}
        <div className="hidden md:flex h-16 border-b border-neutral-800/80 px-8 items-center justify-between sticky top-0 bg-[#141212]/90 backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white capitalize">
              {ADMIN_NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Overview'}
            </h2>
            <span className="text-xs text-neutral-500">•</span>
            <span className="text-xs text-neutral-400">Live Database Connected</span>
          </div>

          <div className="flex items-center gap-3">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/60 transition-all flex items-center gap-2 ${
                  isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-rose-400' : ''} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            )}

            <div className="text-[11px] font-medium text-neutral-400 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
              Role: <span className="text-rose-400 font-bold">Admin</span>
            </div>
          </div>
        </div>

        {/* Dynamic Children View */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
