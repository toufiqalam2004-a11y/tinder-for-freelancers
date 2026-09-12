/**
 * Payment Service Abstraction (V6.1 Demo Mode)
 *
 * Implements a pluggable payment provider pattern. In Demo Mode,
 * simulates card processing (e.g. 4242...), UPI verification, and PayPal
 * with realistic timing and error resilience.
 */

import { subscriptionService } from './subscriptionService.js';
import { usageService } from './usageService.js';

export class PaymentService {
  /**
   * Simulates processing a plan upgrade.
   */
  async processPlanCheckout({ planId, currency, paymentMethod, details }) {
    // Artificial latency for authentic payment UX simulation
    await new Promise((resolve) => setTimeout(resolve, 1400));

    // Demo validation
    if (paymentMethod === 'card') {
      const cleanNum = (details?.cardNumber || '').replace(/\s+/g, '');
      if (cleanNum && cleanNum.length < 12 && !cleanNum.startsWith('4242')) {
        return {
          success: false,
          error: 'Please enter a valid card number (e.g. 4242 4242 4242 4242 for demo).',
        };
      }
    } else if (paymentMethod === 'upi') {
      const upiId = details?.upiId || '';
      if (!upiId.includes('@')) {
        return {
          success: false,
          error: 'Please enter a valid Demo UPI ID (e.g. freelancer@upi).',
        };
      }
    } else if (paymentMethod === 'paypal') {
      const email = details?.paypalEmail || '';
      if (!email.includes('@')) {
        return {
          success: false,
          error: 'Please enter a valid Demo PayPal email.',
        };
      }
    }

    const updatedSub = subscriptionService.changePlan(planId, currency, 30);

    return {
      success: true,
      transactionId: 'txn_demo_' + Date.now(),
      plan: updatedSub.plan,
      currency: updatedSub.currency,
      price: updatedSub.price,
      endDate: updatedSub.endDate,
      message: 'Successfully upgraded to ' + updatedSub.plan.toUpperCase() + ' plan (Demo Mode)!',
    };
  }

  /**
   * Simulates purchasing a credit top-up package.
   */
  async processCreditsCheckout({ packageId, paymentMethod, details }) {
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const result = usageService.addCredits(packageId);

    return {
      success: true,
      transactionId: 'txn_cred_' + Date.now(),
      addedAmount: result.package.amount,
      totalCredits: result.totalCredits,
      message: 'Added ' + result.package.amount + ' Application Credits to your account (Demo Mode)!',
    };
  }
}

export const paymentService = new PaymentService();
