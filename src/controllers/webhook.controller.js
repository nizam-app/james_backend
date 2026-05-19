const Order = require('../models/Order');
const { getStripe } = require('../config/stripe');

async function handleStripeWebhook(req, res) {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return res.status(500).send('Webhook not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await onPaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await onPaymentIntentFailed(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).send('Webhook handler failed');
  }

  return res.json({ received: true });
}

async function onPaymentIntentSucceeded(paymentIntent) {
  const paymentIntentId = paymentIntent.id;
  const orderId = paymentIntent.metadata?.orderId;

  let order =
    (await Order.findOne({ 'payment.paymentIntentId': paymentIntentId })) ||
    (orderId ? await Order.findById(orderId) : null);

  if (!order) {
    console.warn('No order found for PaymentIntent', paymentIntentId);
    return;
  }

  if (order.payment.status === 'paid') {
    return;
  }

  let receiptUrl = null;
  const latestChargeId =
    typeof paymentIntent.latest_charge === 'string'
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id;

  if (latestChargeId) {
    try {
      const stripe = getStripe();
      const charge = await stripe.charges.retrieve(latestChargeId);
      receiptUrl = charge.receipt_url || null;
    } catch (err) {
      console.warn('Could not fetch charge receipt URL:', err.message);
    }
  }

  order.payment.status = 'paid';
  order.payment.paidAt = new Date();
  order.payment.receiptUrl = receiptUrl;
  order.payment.paymentIntentId = paymentIntentId;
  order.payment.failureMessage = null;
  await order.save();
}

async function onPaymentIntentFailed(paymentIntent) {
  const order = await Order.findOne({
    'payment.paymentIntentId': paymentIntent.id,
  });
  if (!order || order.payment.status === 'paid') {
    return;
  }

  order.payment.status = 'failed';
  order.payment.failureMessage =
    paymentIntent.last_payment_error?.message || 'Payment failed';
  await order.save();
}

module.exports = { handleStripeWebhook };
