import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Crown,
  Zap,
  UserCheck,
  AlertTriangle,
  Coins,
  CheckCircle2,
  DollarSign,
  Receipt,
} from 'lucide-react';
import { useAdmin } from './AdminContext';

export default function AdminSubscriptions() {
  const { apiFetch } = useAdmin();
  const [data, setData] = useState({
    stats: null,
    subscriptions: [],
    topUps: {
      stats: {
        totalTopUps: 0,
        totalCreditsPurchased: 0,
        successfulTransactions: 0,
        topUpRevenue: { INR: 0, USD: 0, formatted: '₹0' },
      },
      transactions: [],
    },
  });
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/subscriptions');
      if (res.success) {
        setData({
          stats: res.stats,
          subscriptions: res.subscriptions || [],
          topUps: res.topUps || {
            stats: {
              totalTopUps: 0,
              totalCreditsPurchased: 0,
              successfulTransactions: 0,
              topUpRevenue: { INR: 0, USD: 0, formatted: '₹0' },
            },
            transactions: [],
          },
        });
      }
    } catch (e) {
      console.error('Failed to load subscriptions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const { stats, subscriptions, topUps } = data;
  const topUpStats = topUps?.stats || {
    totalTopUps: 0,
    totalCreditsPurchased: 0,
    successfulTransactions: 0,
    topUpRevenue: { INR: 0, USD: 0, formatted: '₹0' },
  };
  const topUpTransactions = topUps?.transactions || [];

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Subscriptions & Plans</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Review subscription tiers, active candidate memberships, and plan entitlement tiers.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold self-start sm:self-auto">
          <AlertTriangle size={13} />
          <span>Demo Payment Mode (Test Subscriptions)</span>
        </div>
      </div>

      {/* Plan Cards Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Free Plan */}
        <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Free Tier</span>
              <UserCheck size={16} className="text-neutral-500" />
            </div>
            <div className="text-3xl font-black text-white mb-1">
              {loading ? '—' : (stats?.free || 0).toLocaleString()}
            </div>
            <p className="text-xs text-neutral-400">Active free accounts</p>
          </div>
          <div className="pt-4 mt-4 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex justify-between">
            <span>Public Pricing:</span>
            <span className="font-bold text-white">$0/mo • $0/yr</span>
          </div>
        </div>

        {/* Plus Plan */}
        <div className="bg-[#1C1A1A] border border-rose-500/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Plus Tier</span>
              <Crown size={16} className="text-rose-400" />
            </div>
            <div className="text-3xl font-black text-rose-300 mb-1">
              {loading ? '—' : (stats?.plus || 0).toLocaleString()}
            </div>
            <p className="text-xs text-neutral-400">⭐ Most Popular Candidate Plan</p>
          </div>
          <div className="pt-4 mt-4 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex justify-between">
            <span>Public Pricing:</span>
            <span className="font-bold text-rose-300">$7/mo • $70/yr</span>
          </div>
        </div>

        {/* Pro Plan */}
        <div className="bg-[#1C1A1A] border border-amber-500/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Pro Tier</span>
              <Zap size={16} className="text-amber-400" />
            </div>
            <div className="text-3xl font-black text-amber-300 mb-1">
              {loading ? '—' : (stats?.pro || 0).toLocaleString()}
            </div>
            <p className="text-xs text-neutral-400">🚀 Autopilot Mode Enabled</p>
          </div>
          <div className="pt-4 mt-4 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex justify-between">
            <span>Public Pricing:</span>
            <span className="font-bold text-amber-300">$19/mo • $190/yr</span>
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
          Individual Subscription Records ({subscriptions.length})
        </h2>

        <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-900/90 text-neutral-400 border-b border-neutral-800 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-4 py-3.5">Phone</th>
                  <th className="px-4 py-3.5">Plan Tier</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Billing Currency</th>
                  <th className="px-4 py-3.5">Payment Nature</th>
                  <th className="px-5 py-3.5 text-right">Start Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-500">
                      Loading subscription records...
                    </td>
                  </tr>
                ) : subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-500">
                      No subscriptions stored yet.
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-white truncate max-w-[160px]">
                        {sub.userName}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-neutral-300 whitespace-nowrap">
                        {sub.phone || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            sub.plan === 'pro'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : sub.plan === 'plus'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {sub.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-emerald-400 font-medium capitalize">
                        {sub.status}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-neutral-300">{sub.currency}</td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px] font-semibold">
                          Demo / Test
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-neutral-400 whitespace-nowrap text-[11px]">
                        {sub.startDate ? new Date(sub.startDate).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TOP-UP & PURCHASED CREDITS MONITORING SECTION */}
      {/* ========================================================= */}
      <div className="space-y-6 pt-4 border-t border-neutral-800/70">
        <div>
          <div className="flex items-center gap-2">
            <Coins size={20} className="text-amber-400" />
            <h2 className="text-xl font-black text-white tracking-tight">Top-Up & Purchased Credits</h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Monitor candidate credit top-ups and purchased application credits.
          </p>
        </div>

        {/* Top-Up Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Top-Ups */}
          <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Total Top-Ups</span>
              <Receipt size={16} className="text-neutral-500" />
            </div>
            <div className="text-3xl font-black text-white mb-1">
              {loading ? '—' : (topUpStats.totalTopUps || 0).toLocaleString()}
            </div>
            <p className="text-xs text-neutral-400">Recharge transactions completed</p>
          </div>

          {/* Card 2: Purchased Credits */}
          <div className="bg-[#1C1A1A] border border-amber-500/20 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Purchased Credits</span>
              <Coins size={16} className="text-amber-400" />
            </div>
            <div className="text-3xl font-black text-amber-300 mb-1">
              {loading ? '—' : (topUpStats.totalCreditsPurchased || 0).toLocaleString()}
            </div>
            <p className="text-xs text-neutral-400">Credits added to user stacks</p>
          </div>

          {/* Card 3: Successful Transactions */}
          <div className="bg-[#1C1A1A] border border-emerald-500/20 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Successful Transactions</span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-300 mb-1">
              {loading ? '—' : (topUpStats.successfulTransactions || 0).toLocaleString()}
            </div>
            <p className="text-xs text-neutral-400">Verified completed events</p>
          </div>

          {/* Card 4: Top-Up Revenue */}
          <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Top-Up Revenue</span>
              <DollarSign size={16} className="text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white mb-1">
              {loading ? '—' : topUpStats.topUpRevenue?.formatted || '₹0'}
            </div>
            <p className="text-xs text-neutral-400">Real transaction volume</p>
          </div>
        </div>

        {/* Top-Up Transactions Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
            Top-Up Transaction History ({topUpTransactions.length})
          </h3>

          <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-900/90 text-neutral-400 border-b border-neutral-800 uppercase tracking-wider font-bold text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">User</th>
                    <th className="px-4 py-3.5">Phone</th>
                    <th className="px-4 py-3.5">Top-Up Amount</th>
                    <th className="px-4 py-3.5">Currency</th>
                    <th className="px-4 py-3.5">Credits Added</th>
                    <th className="px-4 py-3.5">Transaction Status</th>
                    <th className="px-4 py-3.5">Payment Nature</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-5 py-3.5 text-right">Transaction ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-neutral-500">
                        Loading top-up transaction history...
                      </td>
                    </tr>
                  ) : topUpTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-14 text-center text-neutral-500">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center border border-neutral-800 text-neutral-500">
                            <Coins size={18} />
                          </div>
                          <p className="text-sm font-semibold text-neutral-300">No top-ups yet</p>
                          <p className="text-xs text-neutral-500 max-w-sm">
                            Purchased credit transactions will appear here when users top up.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    topUpTransactions.map((tx) => (
                      <tr key={tx.id || tx.transactionId} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-white truncate max-w-[160px]">
                          {tx.userName}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-neutral-300 whitespace-nowrap">
                          {tx.userPhone || '—'}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-white whitespace-nowrap">
                          {tx.formattedAmount || `${tx.currency} ${tx.amount}`}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-neutral-300">
                          {tx.currency}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            +{tx.creditsAdded} Credits
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold capitalize">
                            <CheckCircle2 size={11} />
                            <span>{tx.status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px] font-semibold">
                            {tx.paymentNature}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-neutral-400 whitespace-nowrap text-[11px]">
                          {tx.date ? new Date(tx.date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-neutral-400 text-[11px] whitespace-nowrap">
                          {tx.transactionId || tx.id}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

