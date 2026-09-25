import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Facebook,
  Radio,
  Youtube,
  MessageSquare,
  FilePlus2,
  Trash2,
  RefreshCw,
  Power,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Card from './Card';
import StatusBadge from './StatusBadge';
import Button from './Button';
import { monitoringService } from '../services/monitoringService';
import { isDemoMode } from '../data/storage.js';

export default function SourceCard({
  source,
  onView,
  onRemove,
  onToggleEnabled,
  onRefreshed,
}) {
  const { platform, name, sourceName, groupName, url, sourceUrl, groupUrl, enabled = true } = source;
  const isBuiltin = source.type === 'builtin' || Boolean(source.isBuiltin) || (Boolean(source.isDemo) && !source.userId);
  const displayName = name || sourceName || groupName || 'Unnamed Source';
  const displayUrl = url || sourceUrl || groupUrl || '';

  const [isChecking, setIsChecking] = useState(false);
  const monitoringData = monitoringService.getStatus(source.id);
  const demoActive = isDemoMode();

  const handleRefresh = async (e) => {
    e.stopPropagation();
    setIsChecking(true);

    try {
      const result = await monitoringService.checkSource(source);
      onRefreshed?.();

      if (result.addedCount > 0) {
        toast.success(
          `Found ${result.rawPostsCount} posts. Added ${result.addedCount} new opportunities (${result.duplicatesRemoved} duplicates filtered).`
        );
      } else if (result.error) {
        toast.error(result.error);
      } else {
        toast(`Synced ${displayName}. Feed is up to date (${result.duplicatesRemoved} duplicates filtered).`, {
          icon: '✨',
        });
      }
    } catch (err) {
      toast.error('Error refreshing source.');
    } finally {
      setIsChecking(false);
    }
  };

  // Platform styling & icons
  const getPlatformMeta = () => {
    switch (platform) {
      case 'reddit':
        return {
          icon: <Radio size={18} className="text-[#FF4500]" />,
          bgColor: 'bg-[#FF4500]/10 border-[#FF4500]/20',
          label: 'Reddit Subreddit',
        };
      case 'youtube':
        return {
          icon: <Youtube size={18} className="text-[#FF0000]" />,
          bgColor: 'bg-[#FF0000]/10 border-[#FF0000]/20',
          label: 'YouTube Search',
        };
      case 'x':
        return {
          icon: <MessageSquare size={18} className="text-text-primary" />,
          bgColor: 'bg-surface-hover border-border',
          label: 'X (Twitter) Search',
        };
      case 'manual_import':
        return {
          icon: <FilePlus2 size={18} className="text-primary" />,
          bgColor: 'bg-primary/10 border-primary/20',
          label: 'Manual Import',
        };
      default:
        return {
          icon: <Facebook size={18} className="text-[#1877F2]" />,
          bgColor: 'bg-[#1877F2]/10 border-[#1877F2]/20',
          label: 'Facebook Group',
        };
    }
  };

  const meta = getPlatformMeta();

  const formatTimeAgo = (isoDate) => {
    if (!isoDate) return 'Never checked';
    const diffSec = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`;
    return new Date(isoDate).toLocaleDateString();
  };

  return (
    <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.15 }}>
      <Card className={`relative overflow-hidden transition-all duration-200 border p-4 ${
        enabled ? 'bg-surface hover:border-primary/40' : 'bg-surface/50 opacity-60 border-dashed border-border'
      }`}>
        {/* Top bar: Platform icon + Display Name + Status badge */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${meta.bgColor}`}
            >
              {meta.icon}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-text-muted block">
                  {meta.label}
                </span>
                {isBuiltin ? (
                  <span className="text-[9px] font-mono uppercase bg-primary/10 text-primary px-1.5 py-0.2 rounded border border-primary/20 font-bold">
                    Built-in
                  </span>
                ) : monitoringData?.isDemo ? (
                  <span className="text-[9px] font-mono uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/20 font-bold">
                    Demo
                  </span>
                ) : (
                  <span className="text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/20 font-bold">
                    Custom
                  </span>
                )}
              </div>
              <h3 className="font-bold text-sm text-text-primary truncate">{displayName}</h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isBuiltin ? (
              <StatusBadge status="Included" variant="primary" />
            ) : enabled ? (
              <StatusBadge status="Connected" variant="success" />
            ) : (
              <StatusBadge status="Disabled" variant="muted" />
            )}
          </div>
        </div>

        {/* URL or Query subtitle */}
        {displayUrl && (
          <div className="text-[11px] text-text-muted truncate font-mono bg-surface-hover px-2.5 py-1 rounded-md border border-border/60 mb-3">
            {displayUrl}
          </div>
        )}

        {/* Actions: Refresh, Enable/Disable, Remove */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            loading={isChecking}
            disabled={!enabled}
            className="text-xs !py-1.5 !px-3 font-medium"
          >
            <RefreshCw size={13} className={`mr-1.5 ${isChecking ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleEnabled}
              className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
                enabled
                  ? 'border-border text-text-secondary hover:text-amber-500 hover:border-amber-500/40 bg-surface'
                  : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
              }`}
              title={enabled ? 'Disable source' : 'Enable source'}
            >
              <Power size={13} />
              <span className="text-[10px] font-medium">{enabled ? 'Disable' : 'Enable'}</span>
            </button>

            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 rounded-lg text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              title="Remove source"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
