import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, ArrowRight, Eye, EyeOff, AlertCircle, Briefcase } from 'lucide-react';
import { useAdmin } from './AdminContext';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAdmin();
  const [passkey, setPasskey] = useState('');
  const [phone, setPhone] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already authenticated as admin, redirect to dashboard overview
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passkey.trim()) {
      setError('Please enter your administrator passkey.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(passkey.trim(), phone.trim() || null);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Invalid administrator passkey.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#141212] text-[#FAF7F2] font-sans flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden selection:bg-rose-500/30 selection:text-rose-200">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-gradient-to-b from-[#E11D48]/15 to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#E11D48] to-[#F43F6E] p-0.5 shadow-xl shadow-rose-950/50 mx-auto mb-4 flex items-center justify-center">
            <div className="w-full h-full bg-[#141212] rounded-[10px] flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-[#F43F6E]" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            Admin Console
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300">
              Restricted
            </span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Tinder for Freelancers • Internal Management System
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#1C1A1A] border border-neutral-800 rounded-3xl p-7 sm:p-8 shadow-2xl relative">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-neutral-800/80">
            <Shield className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Administrator Verification
            </span>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Passkey input */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2">
                Administrator Passkey <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPasskey ? 'text' : 'password'}
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  placeholder="Enter admin secret key"
                  required
                  className="w-full pl-4 pr-11 py-3 rounded-xl bg-neutral-900 border border-neutral-700/80 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors shadow-inner placeholder:text-neutral-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPasskey(!showPasskey)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPasskey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Optional admin phone */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2">
                Admin Phone (Optional)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0100 or +91..."
                className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-700/80 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors shadow-inner placeholder:text-neutral-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#E11D48] to-[#F43F6E] hover:from-rose-600 hover:to-rose-500 shadow-xl shadow-rose-950/60 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Access Admin Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Safe security footer note */}
          <div className="mt-6 pt-5 border-t border-neutral-800/80 text-center">
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Protected interface with server-side authorization enforcement. All administrative sessions are strictly logged and monitored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
