import React, { useState } from 'react';
import { CreditCard, Smartphone, Globe, ShieldCheck, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import { paymentService } from '../services/paymentService';
import toast from 'react-hot-toast';

export default function DemoPaymentModal({
  isOpen,
  onClose,
  checkoutType = 'plan', // 'plan' | 'credits'
  itemDetails = {},
  onSuccess,
}) {
  const [method, setMethod] = useState('card'); // 'card' | 'upi' | 'paypal'
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('999');
  const [upiId, setUpiId] = useState('freelancer@okhdfcbank');
  const [paypalEmail, setPaypalEmail] = useState('freelancer@demo.com');

  if (!isOpen) return null;

  const handlePay = async (e) => {
    e?.preventDefault();
    setLoading(true);

    try {
      let res;
      if (checkoutType === 'plan') {
        res = await paymentService.processPlanCheckout({
          planId: itemDetails.planId,
          currency: itemDetails.currency,
          paymentMethod: method,
          details: {
            cardNumber,
            upiId,
            paypalEmail,
          },
        });
      } else {
        res = await paymentService.processCreditsCheckout({
          packageId: itemDetails.packageId,
          paymentMethod: method,
          details: {
            cardNumber,
            upiId,
            paypalEmail,
          },
        });
      }

      if (res.success) {
        toast.success(res.message, { icon: '🎉', duration: 4000 });
        if (onSuccess) onSuccess(res);
        onClose();
      } else {
        toast.error(res.error || 'Payment failed');
      }
    } catch (err) {
      toast.error(err.message || 'Payment simulation error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title="Demo Payment Simulation">
      <div className="space-y-4">
        {/* Banner highlighting Demo Mode */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block uppercase tracking-wider text-[10px]">Demo Mode Active</span>
            <span>No real card or bank charges will occur. Test credentials are pre-filled for instant verification.</span>
          </div>
        </div>

        {/* Order Summary */}
        <div className="p-3.5 rounded-xl bg-surface-hover border border-border flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-text-primary text-sm block">{itemDetails.title || 'Subscription Plan'}</span>
            <span className="text-text-muted">{itemDetails.subtitle || '30-day access'}</span>
          </div>
          <div className="text-right">
            <span className="text-base font-extrabold text-primary block">{itemDetails.priceFormatted}</span>
            <span className="text-[10px] text-text-muted">Incl. all taxes</span>
          </div>
        </div>

        {/* Payment Method Selector Tabs */}
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-2">Choose Demo Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => setMethod('card')}
              className={'p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs transition-all ' + (
                method === 'card'
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                  : 'border-border bg-surface text-text-secondary hover:bg-surface-hover'
              )}
            >
              <CreditCard size={18} />
              <span>Card</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => setMethod('upi')}
              className={'p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs transition-all ' + (
                method === 'upi'
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                  : 'border-border bg-surface text-text-secondary hover:bg-surface-hover'
              )}
            >
              <Smartphone size={18} />
              <span>UPI / QR</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => setMethod('paypal')}
              className={'p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs transition-all ' + (
                method === 'paypal'
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                  : 'border-border bg-surface text-text-secondary hover:bg-surface-hover'
              )}
            >
              <Globe size={18} />
              <span>PayPal</span>
            </button>
          </div>
        </div>

        {/* Dynamic Fields */}
        <div className="space-y-2.5 pt-1">
          {method === 'card' && (
            <>
              <Input
                label="Demo Card Number"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4242 4242 4242 4242"
                disabled={loading}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Expiry (MM/YY)"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  placeholder="12/28"
                  disabled={loading}
                />
                <Input
                  label="Demo CVC"
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value)}
                  placeholder="999"
                  disabled={loading}
                />
              </div>
            </>
          )}

          {method === 'upi' && (
            <Input
              label="Demo Virtual Payment Address (VPA)"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="freelancer@upi"
              disabled={loading}
            />
          )}

          {method === 'paypal' && (
            <Input
              label="Demo PayPal Account"
              value={paypalEmail}
              onChange={(e) => setPaypalEmail(e.target.value)}
              placeholder="freelancer@demo.com"
              disabled={loading}
            />
          )}
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-muted pt-1">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>Simulated 256-bit SSL Encrypted Sandbox</span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <Button
            variant="primary"
            fullWidth
            onClick={handlePay}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Simulating Payment...</span>
              </span>
            ) : (
              'Authorize Demo Payment (' + (itemDetails.priceFormatted || '$0') + ')'
            )}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            onClick={onClose}
            disabled={loading}
            size="sm"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
