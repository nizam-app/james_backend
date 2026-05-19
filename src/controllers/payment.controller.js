const Order = require('../models/Order');
const { getStripe } = require('../config/stripe');
const { calculateTotals } = require('../utils/calculateTotals');

function validateCustomer(body) {
  const c = body.customer || body;
  const fullName = String(c.fullName || c.name || '').trim();
  const phone = String(c.phone || '').trim();
  const email = String(c.email || '').trim();
  const address = String(c.address || '').trim();
  const city = String(c.city || '').trim();
  const state = String(c.state || '').trim();
  const zip = String(c.zip || '').trim();

  const missing = [];
  if (!fullName) missing.push('fullName');
  if (!phone) missing.push('phone');
  if (!email) missing.push('email');
  if (!address) missing.push('address');
  if (!city) missing.push('city');
  if (!state) missing.push('state');
  if (!zip) missing.push('zip');

  if (missing.length) {
    return { error: `Missing required fields: ${missing.join(', ')}` };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Invalid email address' };
  }

  return {
    customer: {
      fullName,
      phone,
      email,
      address,
      city,
      state,
      zip,
      instructions: String(c.instructions || '').trim(),
      notes: String(c.notes || '').trim(),
    },
  };
}

async function createPaymentIntent(req, res) {
  const customerResult = validateCustomer(req.body);
  if (customerResult.error) {
    return res.status(400).json({ message: customerResult.error });
  }

  const cart = req.body.cart;
  const rental = req.body.rental || {};
  const startDate = rental.startDate || req.body.startDate;
  const endDate = rental.endDate || req.body.endDate;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'Rental start and end dates are required' });
  }

  const totalsResult = calculateTotals({
    cart,
    startDate,
    endDate,
    zip: customerResult.customer.zip,
    protectionChecked: Boolean(
      req.body.protectionChecked ?? req.body.options?.protectionChecked
    ),
    afterHoursChecked: Boolean(
      req.body.afterHoursChecked ?? req.body.options?.afterHoursChecked
    ),
  });

  if (totalsResult.error) {
    return res.status(400).json({ message: totalsResult.error });
  }

  const order = await Order.create({
    customer: customerResult.customer,
    rental: {
      startDate,
      endDate,
      rentalDays: totalsResult.rentalDays,
    },
    lineItems: totalsResult.lineItems,
    totals: {
      subtotal: totalsResult.subtotal,
      deliveryFee: totalsResult.deliveryFee,
      pickupFee: totalsResult.pickupFee,
      afterHoursDispatchFee: totalsResult.afterHoursDispatchFee,
      protectionEligibleSubtotal: totalsResult.protectionEligibleSubtotal,
      protectionFee: totalsResult.protectionFee,
      taxRate: totalsResult.taxRate,
      taxCounty: totalsResult.taxCounty,
      tax: totalsResult.tax,
      grandTotal: totalsResult.grandTotal,
      amountCents: totalsResult.amountCents,
      protectionChecked: totalsResult.protectionChecked,
      afterHoursChecked: totalsResult.afterHoursChecked,
    },
    payment: { status: 'pending' },
  });

  const stripe = getStripe();
  const { customer } = customerResult;

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: totalsResult.amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: String(order._id),
        customerEmail: customer.email,
        customerName: customer.fullName,
      },
      receipt_email: customer.email,
      description: `DIY-DRY equipment rental — ${customer.fullName}`,
    });
  } catch (err) {
    await Order.findByIdAndDelete(order._id);
    console.error('Stripe PaymentIntent create failed:', err.message);
    return res.status(502).json({
      message: err.message || 'Unable to create payment. Please try again.',
    });
  }

  order.payment.paymentIntentId = paymentIntent.id;
  await order.save();

  return res.status(200).json({
    clientSecret: paymentIntent.client_secret,
    orderId: String(order._id),
    amountCents: totalsResult.amountCents,
    grandTotal: totalsResult.grandTotal,
  });
}

module.exports = { createPaymentIntent };
