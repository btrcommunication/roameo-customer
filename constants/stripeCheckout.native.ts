import { initPaymentSheet, initStripe, presentPaymentSheet } from '@stripe/stripe-react-native';
import * as Linking from 'expo-linking';

interface CheckoutParams {
  publishableKey: string;
  clientSecret?: string;
}

export const openStripeCheckout = async ({ publishableKey, clientSecret }: CheckoutParams) => {
  if (!clientSecret) throw new Error('The payment server did not return a PaymentIntent client secret.');

  await initStripe({ publishableKey, urlScheme: Linking.createURL('') });
  const { error: initError } = await initPaymentSheet({
    merchantDisplayName: 'Roameo',
    paymentIntentClientSecret: clientSecret,
    returnURL: Linking.createURL('stripe-redirect'),
    allowsDelayedPaymentMethods: false,
    defaultBillingDetails: { name: 'Roameo Customer' },
  });
  if (initError) throw new Error(initError.message);

  const { error } = await presentPaymentSheet();
  return { error, redirected: false };
};
