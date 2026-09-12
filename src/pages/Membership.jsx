import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown, Sparkles, Check, Zap, Shield, ArrowRight,
  TrendingUp, Clock, AlertCircle, HelpCircle, CheckCircle2,
  RefreshCw, Layers, ShieldCheck, Flame, Star
} from 'lucide-react';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import Card from '../components/Card';
import Button from '../components/Button';
import DemoPaymentModal from '../components/DemoPaymentModal';
import { subscriptionService } from '../services/subscriptionService';
import { usageService } from '../services/usageService';
import { SUBSCRIPTION_PLANS, CREDIT_PACKAGES } from '../utils/constants';
import toast from 'react-hot-toast';

export default function Membership() {
  const navigate = useNavigate();

  // State
  const [sub, setSub] = useState(() => subscriptionService.getSubscription());
  const [currency, setCurrency] = useState(() => subscriptionService.getCurrency());
  const [todayUsage, setTodayUsage] = useState(() => usageService.getTodayUsage());
  const [creditsSummary, setCreditsSummary] = useState(() => usageService.getCreditsSummary());
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutItem, setCheckoutItem] = useState({});
  const [checkoutType, setCheckoutType] = useState('plan'); // 'plan' | 'credits'

  const refreshAll = useCallback(() => {
    setSub(subscriptionService.getSubscription());
    setCurrency(subscriptionService.getCurrency());
    setTodayUsage(usageService.getTodayUsage());
    setCreditsSummary(usageService.getCreditsSummary());
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Switch Currency
  const handleCurrencyChange = (newCurr) => {
    subscriptionService.setCurrency(newCurr);
    setCurrency(newCurr);
    refreshAll();
    toast.success('Currency switched to ' + (newCurr === 'INR' ? '₹ INR' : '$ USD'));
  };

  // Open Checkout for a Plan
  const handleSelectPlan = (planKey) => {
    const plan = SUBSCRIPTION_PLANS[planKey];
    if (plan.id === sub.plan) {
      toast('You are currently on this plan.', { icon: 'ℹ️' });
      return;
    }

    if (plan.id === 'free') {
      subscriptionService.changePlan('free', currency);
      toast.success('Switched to Free plan.');
      refreshAll();
      return;
    }

    const price = plan.prices[currency];
    const formatted = subscriptionService.formatPrice(price, currency);

    setCheckoutType('plan');
    setCheckoutItem({
      planId: plan.id,
      title: plan.name + ' Membership',
      subtitle: plan.tagline + ' • 30 Days Access',
      currency,
      price,
      priceFormatted: formatted,
    });
    setIsCheckoutOpen(true);
  };

  // Open Checkout for Credits
  const handleSelectCredits = (pkg) => {
    const price = pkg.prices[currency];
    const formatted = subscriptionService.formatPrice(price, currency);

    setCheckoutType('credits');
    setCheckoutItem({
      packageId: pkg.id,
      title: pkg.amount + ' Application Credits',
      subtitle: 'Valid for ' + pkg.validityDays + ' days',
      currency,
      price,
      priceFormatted: formatted,
    });
    setIsCheckoutOpen(true);
  };

  const currentPlan = subscriptionService.getCurrentPlanDetails();
  const dailyLimit = currentPlan.limits.applicationsPerDay;
  const usedToday = todayUsage.applicationsUsed || 0;
  const remainingDaily = Math.max(0, dailyLimit - usedToday);
  const dailyPct = Math.min(100, Math.round((usedToday / dailyLimit) * 100));

  const aiLimit = currentPlan.limits.aiApplyPerDay;
  const aiUsed = todayUsage.aiApplyUsed || 0;
  const aiPct = Math.min(100, Math.round((aiUsed / aiLimit) * 100));

  // Expiration calculation
  let daysRemaining = null;
  if (sub.endDate) {
    const diff = new Date(sub.endDate).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return (
    <PageTransition>
      <div className="max-w-md mx-auto px-4 py-5 pb-28 space-y-5">
        {/* Header Title & Currency Switcher */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-text-primary flex items-center gap-1.5">
              <Crown size={20} className="text-primary" />
              <span>Membership & Quotas</span>
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Scale your freelance client discovery
            </p>
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center bg-surface-hover p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => handleCurrencyChange('INR')}
              className={'px-2.5 py-1 rounded-lg text-xs font-bold transition-all ' + (
                currency === 'INR'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              ₹ INR
            </button>
            <button
              type="button"
              onClick={() => handleCurrencyChange('USD')}
              className={'px-2.5 py-1 rounded-lg text-xs font-bold transition-all ' + (
                currency === 'USD'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              $ USD
            </button>
          </div>
        </div>

        {/* Current Active Plan Card with Live Usage */}
        <Card className="p-4 bg-surface border border-border shadow-sm space-y-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Current Plan
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <h2 className="text-lg font-extrabold text-text-primary">
                  {currentPlan.name} Plan
                </h2>
                {currentPlan.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {currentPlan.badge}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              {sub.plan === 'free' ? (
                <span className="text-xs font-semibold text-text-muted">Standard Tier</span>
              ) : (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck size={14} />
                  <span>{daysRemaining !== null ? (daysRemaining + ' days left') : 'Active'}</span>
                </span>
              )}
            </div>
          </div>

          {/* Progress Bars */}
          <div className="space-y-2.5 pt-1">
            {/* Daily Application Quota */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-text-secondary">
                  Today's Applications: <strong className="text-text-primary">{usedToday} / {dailyLimit}</strong>
                </span>
                <span className="font-bold text-primary">{remainingDaily} remaining</span>
              </div>
              <div className="w-full bg-surface-hover h-2 rounded-full overflow-hidden">
                <div
                  className="h-full gradient-primary rounded-full transition-all duration-500"
                  style={{ width: dailyPct + '%' }}
                />
              </div>
            </div>

            {/* AI Apply Generations */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-text-secondary">
                  AI Apply Generations: <strong className="text-text-primary">{aiUsed} / {aiLimit}</strong>
                </span>
                <span className="font-bold text-amber-500">{aiLimit - aiUsed} remaining</span>
              </div>
              <div className="w-full bg-surface-hover h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: aiPct + '%' }}
                />
              </div>
            </div>
          </div>

          {/* Purchased Credits Banner */}
          <div className="p-3 rounded-xl bg-surface-hover/70 border border-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <Sparkles size={14} />
              </div>
              <div>
                <span className="font-bold text-text-primary block">
                  {creditsSummary.activeCredits} Extra Credits
                </span>
                <span className="text-[10px] text-text-muted">
                  Consumed after daily quota runs out
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('credits-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-[11px] font-bold text-primary hover:underline"
            >
              + Add Credits
            </button>
          </div>
        </Card>

        {/* Plan Selection Cards */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <Layers size={14} className="text-primary" />
            <span>Choose Your Plan</span>
          </h3>

          {Object.values(SUBSCRIPTION_PLANS).map((plan) => {
            const isCurrent = sub.plan === plan.id;
            const price = plan.prices[currency];
            const priceStr = subscriptionService.formatPrice(price, currency);

            return (
              <Card
                key={plan.id}
                className={'p-4 transition-all relative ' + (
                  isCurrent
                    ? 'border-2 border-primary shadow-md bg-surface'
                    : 'border-border bg-surface hover:border-primary/40'
                )}
              >
                {plan.badge && (
                  <div className="absolute top-3 right-3">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary text-white shadow-sm">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="pr-16">
                  <h4 className="text-base font-extrabold text-text-primary">{plan.name}</h4>
                  <p className="text-xs text-text-secondary mt-0.5">{plan.tagline}</p>
                </div>

                <div className="my-3">
                  <span className="text-2xl font-black text-text-primary">{priceStr}</span>
                  {plan.id !== 'free' && (
                    <span className="text-xs text-text-muted font-medium ml-1">/ month</span>
                  )}
                </div>

                {/* Features List */}
                <ul className="space-y-1.5 text-xs text-text-secondary border-t border-border pt-3 mb-4">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check size={13} className="text-emerald-500 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                {/* Action Button */}
                <Button
                  variant={isCurrent ? 'outline' : plan.id === 'pro' ? 'primary' : 'secondary'}
                  fullWidth
                  disabled={isCurrent}
                  onClick={() => handleSelectPlan(plan.id.toUpperCase())}
                  size="sm"
                >
                  {isCurrent ? (
                    <span className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 size={14} /> Current Plan
                    </span>
                  ) : plan.id === 'free' ? (
                    'Downgrade to Free'
                  ) : (
                    'Upgrade to ' + plan.name
                  )}
                </Button>
              </Card>
            );
          })}
        </div>

        {/* Application Credits Top-up Store */}
        <div id="credits-section" className="space-y-3 pt-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              <span>Application Credits Store</span>
            </h3>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Need extra applications without upgrading your monthly plan? Buy on-demand packs. Valid for 30 days.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {CREDIT_PACKAGES.map((pkg) => {
              const price = pkg.prices[currency];
              const priceFormatted = subscriptionService.formatPrice(price, currency);

              return (
                <div
                  key={pkg.id}
                  className="p-3.5 rounded-2xl border border-border bg-surface hover:border-amber-500/50 transition-all flex flex-col justify-between relative"
                >
                  {pkg.badge && (
                    <span className="absolute -top-2 right-2 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-amber-500 text-white shadow-xs">
                      {pkg.badge}
                    </span>
                  )}

                  <div>
                    <span className="text-sm font-extrabold text-text-primary block">
                      {pkg.label}
                    </span>
                    <span className="text-[10px] text-text-muted block mt-0.5">
                      {pkg.subtext}
                    </span>
                    <div className="text-lg font-black text-primary mt-2">
                      {priceFormatted}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    fullWidth
                    className="mt-3 border-amber-500/40 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs"
                    onClick={() => handleSelectCredits(pkg)}
                  >
                    Buy Pack
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Transparent Guarantee note */}
        <div className="p-3 rounded-xl bg-surface-hover border border-border text-[11px] text-text-muted text-center leading-relaxed">
          <ShieldCheck size={14} className="inline mr-1 text-primary" />
          <span>
            Demo billing simulation. You can switch plans or purchase test credits anytime without being charged.
          </span>
        </div>
      </div>

      {/* Demo Checkout Modal */}
      <DemoPaymentModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        checkoutType={checkoutType}
        itemDetails={checkoutItem}
        onSuccess={() => {
          refreshAll();
        }}
      />
    </PageTransition>
  );
}
