import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, ExternalLink, Sparkles, AlertCircle, Bookmark } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsRead,
  clearNotifications,
} from '../data/storage';
import toast from 'react-hot-toast';

export default function NotificationsModal({ isOpen, onClose, onRefresh }) {
  const navigate = useNavigate();
  const notifs = getNotifications();

  const handleMarkAll = () => {
    markAllNotificationsRead();
    onRefresh?.();
    toast.success('All notifications marked as read');
  };

  const handleClear = () => {
    clearNotifications();
    onRefresh?.();
    toast.success('Cleared notifications');
  };

  const handleClickItem = (item) => {
    markNotificationAsRead(item.id);
    onRefresh?.();
    onClose();
    if (item.jobId) {
      navigate(`/job/${item.jobId}`);
    } else if (item.applicationId) {
      navigate(`/application/${item.applicationId}`);
    } else {
      navigate('/jobs');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'high_match':
        return <Sparkles size={16} className="text-emerald-500" />;
      case 'saved_search_alert':
        return <Bookmark size={16} className="text-primary" />;
      case 'application_update':
        return <Check size={16} className="text-blue-500" />;
      default:
        return <Bell size={16} className="text-amber-500" />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Notifications">
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <span className="text-xs text-text-muted">
            {notifs.filter((n) => !n.read).length} unread updates
          </span>
          <div className="flex items-center gap-2">
            {notifs.length > 0 && (
              <>
                <button
                  onClick={handleMarkAll}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <Check size={13} />
                  Mark all read
                </button>
                <span className="text-text-muted">•</span>
                <button
                  onClick={handleClear}
                  className="text-xs text-text-muted hover:text-rose-500 flex items-center gap-1 font-medium transition-colors"
                >
                  <Trash2 size={13} />
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {/* List */}
        {notifs.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mx-auto text-text-muted mb-2">
              <Bell size={20} />
            </div>
            <p className="text-sm font-semibold text-text-primary">All caught up!</p>
            <p className="text-xs text-text-muted mt-0.5">
              High-match job alerts and status updates will show up here.
            </p>
          </div>
        ) : (
          <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
            {notifs.map((item) => (
              <div
                key={item.id}
                onClick={() => handleClickItem(item)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  item.read
                    ? 'bg-surface/50 border-border opacity-70 hover:opacity-100'
                    : 'bg-surface border-primary/30 shadow-sm hover:border-primary/60'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 p-1.5 rounded-lg bg-surface-hover border border-border">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-text-primary truncate">
                        {item.title}
                      </h4>
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2">
                      {item.message}
                    </p>
                    <span className="text-[10px] text-text-muted mt-1.5 block">
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button variant="secondary" fullWidth onClick={onClose} size="sm">
          Close
        </Button>
      </div>
    </Modal>
  );
}
