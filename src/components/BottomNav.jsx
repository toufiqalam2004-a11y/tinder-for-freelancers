import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, Globe, FileText, User, Bot } from 'lucide-react';

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: '/jobs', label: 'Jobs', icon: Briefcase },
    { path: '/autopilot', label: 'Autopilot', icon: Bot },
    { path: '/sources', label: 'Sources', icon: Globe },
    { path: '/applications', label: 'Applications', icon: FileText },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/85 backdrop-blur-md border-t border-border shadow-lg safe-bottom transition-colors">
      <div className="flex items-center justify-around max-w-md mx-auto px-2 h-16">
        {tabs.map((tab) => {
          const isActive = location.pathname.startsWith(tab.path);
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-200 ${
                isActive ? 'text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{tab.label}</span>
              <div 
                className={`w-1 h-1 rounded-full bg-primary mt-0.5 transition-opacity duration-200 ${
                  isActive ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
