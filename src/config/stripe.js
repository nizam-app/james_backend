const Stripe = require('stripe');

let stripeClient = null;

function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

module.exports = { getStripe };
