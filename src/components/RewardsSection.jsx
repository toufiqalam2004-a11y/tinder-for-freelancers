import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Users, Copy, Share2, Check, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from './Card';
import Button from './Button';
import { rewardService } from '../services/rewardService';

export default function RewardsSection() {
  const [rewardStatus, setRewardStatus] = useState(() => rewardService.getRewardCache());
  const [referralStatus, setReferralStatus] = useState({
    referralCode: '',
    referralLink: '',
    referralCount: 0,
  });
  const [copiedCode, setCopiedCode] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [rStatus, refStatus] = await Promise.all([
        rewardService.getRewardStatus(),
        rewardService.getReferralStatus(),
      ]);
      if (rStatus) setRewardStatus(rStatus);
      if (refStatus && refStatus.success) {
        setReferralStatus({
          referralCode: refStatus.referralCode || '',
          referralLink: refStatus.referralLink || `${window.location.origin}/?ref=${refStatus.referralCode || ''}`,
          referralCount: refStatus.referralCount || 0,
        });
      }
    } catch (e) {
      console.warn('Could not load rewards and referral data:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleRewardsChanged = () => {
      setRewardStatus(rewardService.getRewardCache());
    };
    window.addEventListener('tf_rewards_changed', handleRewardsChanged);
    return () => window.removeEventListener('tf_rewards_changed', handleRewardsChanged);
  }, [loadData]);

  // Claim Daily Login Reward
  const handleClaimDaily = async () => {
    if (isClaiming) return;
    setIsClaiming(true);
    try {
      const res = await rewardService.claimDailyLoginReward();
      if (res.granted) {
        toast.success('🎁 Daily Login Reward\n+1 application credit added!');
        loadData();
      } else {
        toast('Already claimed today ✓', { icon: 'ℹ️' });
      }
    } catch (e) {
      toast.error('Failed to claim reward.');
    } finally {
      setIsClaiming(false);
    }
  };

  // Copy Referral Code
  const handleCopyCode = () => {
    const code = referralStatus.referralCode;
    if (!code) return;
    try {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      toast.success(`Referral code ${code} copied!`);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Could not copy code.');
    }
  };

  // Share Referral Invite (Web Share API with fallback)
  const handleShare = async () => {
    const code = referralStatus.referralCode;
    const link = referralStatus.referralLink || `${window.location.origin}/?ref=${code}`;
    const shareText = `🚀 Try Tinder for Freelancers — swipe, match and get hired!\n\nJoin using my invite and get 5 free application credits.\n\n${link}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Tinder for Freelancers - 5 Free Application Credits',
          text: shareText,
          url: link,
        });
        return;
      } catch (err) {
        // Fall back to clipboard if user dismissed share dialog or API failed
        if (err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Referral link copied!');
    } catch {
      toast.error('Could not copy link.');
    }
  };

  const claimedToday = !!rewardStatus?.claimedToday;

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
          <Sparkles size={14} className="text-primary" /> Rewards & Referrals
        </h3>
        <span className="text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
          +{rewardStatus?.rewardCredits || 0} Reward Credits
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 1. Daily Login Reward Card */}
        <Card className="p-3.5 bg-surface border border-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-base">
                🎁
              </div>
              <div>
                <h4 className="text-xs font-bold text-text-primary">Daily Login Reward</h4>
                <p className="text-[11px] text-text-muted">Login every day and get +1 application</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-hover/70 border border-border/80 my-2 text-xs flex items-center justify-between">
              <span className="text-text-secondary">Daily Streak Reward:</span>
              <strong className="text-primary font-extrabold">+1 Application</strong>
            </div>
          </div>

          <div className="pt-2 border-t border-border/60">
            {claimedToday ? (
              <div className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5">
                <Check size={14} />
                <span>Claimed Today ✓</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleClaimDaily}
                disabled={isClaiming}
                className="w-full py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
              >
                <Gift size={14} />
                <span>Login today to claim +1 application</span>
              </button>
            )}
          </div>
        </Card>

        {/* 2. Referral System Card */}
        <Card className="p-3.5 bg-surface border border-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-base">
                👥
              </div>
              <div>
                <h4 className="text-xs font-bold text-text-primary">Invite Friends</h4>
                <p className="text-[11px] text-text-muted">Your friend gets +5 free applications</p>
              </div>
            </div>

            {/* Referral Code Box */}
            <div className="p-2 rounded-xl bg-surface-hover/70 border border-border/80 my-2 flex items-center justify-between text-xs">
              <div className="pl-1">
                <span className="text-[10px] text-text-muted block uppercase font-semibold">Your Referral Code</span>
                <span className="font-mono font-black text-sm text-text-primary tracking-wider">
                  {referralStatus.referralCode || 'Generating...'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-text-primary hover:text-primary font-bold text-[11px] flex items-center gap-1 transition-all"
              >
                {copiedCode ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={handleShare}
              className="w-full py-2 px-3 rounded-xl gradient-primary text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
            >
              <Share2 size={13} />
              <span>Share Invite (+5 Apps)</span>
            </button>

            <div className="text-center text-[10px] text-text-muted font-medium">
              <span>{referralStatus.referralCount} {referralStatus.referralCount === 1 ? 'Friend' : 'Friends'} Joined</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
