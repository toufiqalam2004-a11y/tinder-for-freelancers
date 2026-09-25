import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Check, Loader2 } from 'lucide-react';

export default function CaptchaWidget({ onVerify, onExpire, resetTrigger }) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  // Local human verification state for local development when no siteKey is provided
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // Handle reset
  useEffect(() => {
    setIsVerified(false);
    setIsVerifying(false);
    if (siteKey && window.turnstile && widgetIdRef.current !== null) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch (e) {
        // ignore
      }
    }
  }, [resetTrigger, siteKey]);

  // Turnstile production integration
  useEffect(() => {
    if (!siteKey) return;

    let isMounted = true;

    const renderWidget = () => {
      if (window.turnstile && containerRef.current && widgetIdRef.current === null) {
        try {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: 'dark',
            callback: (token) => {
              if (isMounted) onVerify(token);
            },
            'expired-callback': () => {
              if (isMounted && onExpire) onExpire();
            },
            'error-callback': () => {
              if (isMounted && onExpire) onExpire();
            },
          });
        } catch (e) {
          console.warn('[Turnstile render error]:', e);
        }
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const scriptId = 'cf-turnstile-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = renderWidget;
        document.head.appendChild(script);
      } else {
        const existingScript = document.getElementById(scriptId);
        existingScript.addEventListener('load', renderWidget);
      }
    }

    return () => {
      isMounted = false;
      if (siteKey && window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch (e) {
          // ignore
        }
      }
    };
  }, [siteKey, onVerify, onExpire]);

  // If Cloudflare Turnstile site key is configured, use it
  if (siteKey) {
    return (
      <div className="flex justify-center my-3">
        <div ref={containerRef} className="cf-turnstile" />
      </div>
    );
  }

  // Interactive verification widget for local development / test environments
  const handleLocalVerify = () => {
    if (isVerifying || isVerified) return;
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setIsVerified(true);
      const token = `turnstile-local-verified-${Date.now()}`;
      onVerify(token);
    }, 450);
  };

  return (
    <div
      onClick={handleLocalVerify}
      className={`my-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
        isVerified
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-surface-hover/70 hover:bg-surface-hover border-border hover:border-text-muted/40'
      }`}
      role="checkbox"
      aria-checked={isVerified}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleLocalVerify();
        }
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center border transition-all ${
            isVerified
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-text-muted/50 bg-surface'
          }`}
        >
          {isVerifying ? (
            <Loader2 size={14} className="animate-spin text-primary" />
          ) : isVerified ? (
            <Check size={14} strokeWidth={3} />
          ) : null}
        </div>
        <span className="text-xs font-medium text-text-primary">
          {isVerified ? 'Verification passed' : 'Verify you are human'}
        </span>
      </div>

      <div className="flex items-center gap-1.5 opacity-60 text-[10px] text-text-muted">
        <ShieldCheck size={14} className="text-primary" />
        <span className="font-mono">Security Check</span>
      </div>
    </div>
  );
}
