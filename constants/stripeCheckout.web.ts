interface CheckoutParams {
  publishableKey: string;
  checkoutUrl?: string;
}

export const openStripeCheckout = async ({ checkoutUrl }: CheckoutParams) => {
  if (!checkoutUrl) {
    throw new Error('For web checkout, the payment server must return a Stripe Checkout URL in checkoutUrl.');
  }
  window.location.assign(checkoutUrl);
  return { error: undefined, redirected: true };
};
