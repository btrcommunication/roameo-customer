interface CheckoutParams {
  publishableKey: string;
  clientSecret?: string;
  checkoutUrl?: string;
}

interface CheckoutResult {
  error?: { code?: string; message: string };
  redirected: boolean;
}

export declare const openStripeCheckout: (params: CheckoutParams) => Promise<CheckoutResult>;
