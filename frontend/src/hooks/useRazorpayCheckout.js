import { useCallback, useEffect, useState } from 'react';

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
}

/**
 * Opens Razorpay checkout modal.
 * Resolves on success; rejects with message on dismiss or failure.
 */
export function useRazorpayCheckout() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRazorpayScript().catch(() => {});
  }, []);

  const openCheckout = useCallback(
    async ({ razorpay, order, driver, onSuccess, onDismiss, onFailed }) => {
      setLoading(true);
      try {
        const Razorpay = await loadRazorpayScript();
        if (!razorpay?.keyId || !razorpay?.orderId) {
          throw new Error('Payment is not configured');
        }

        return await new Promise((resolve, reject) => {
          const orderId = order?._id || order?.id;

          const rzp = new Razorpay({
            key: razorpay.keyId,
            amount: razorpay.amount,
            currency: razorpay.currency,
            name: razorpay.name || 'SearchMyDriver',
            description: razorpay.description || 'Driver Kit',
            order_id: razorpay.orderId,
            prefill: {
              name: driver?.name || '',
              email: driver?.email || '',
              contact: driver?.phone ? `+91${driver.phone}` : '',
            },
            theme: { color: '#F5C518' },
            handler: async (response) => {
              try {
                await onSuccess?.(response);
                resolve(response);
              } catch (err) {
                reject(err);
              }
            },
            modal: {
              ondismiss: () => {
                onDismiss?.();
                reject(new Error('Payment cancelled'));
              },
            },
          });

          rzp.on('payment.failed', (response) => {
            onFailed?.(response, orderId);
            reject(new Error('Payment failed'));
          });

          rzp.open();
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { openCheckout, loading };
}
