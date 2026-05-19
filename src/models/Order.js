const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    billingType: { type: String, enum: ['per_day', 'per_sf', 'flat'], required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
    rentalDays: { type: Number },
    ratePerSf: { type: Number },
    squareFootage: { type: Number },
    protectionEligible: { type: Boolean, default: false },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    zip: { type: String, required: true, trim: true },
    instructions: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const rentalSchema = new mongoose.Schema(
  {
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    rentalDays: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const totalsSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    pickupFee: { type: Number, required: true },
    afterHoursDispatchFee: { type: Number, default: 0 },
    protectionEligibleSubtotal: { type: Number, default: 0 },
    protectionFee: { type: Number, default: 0 },
    taxRate: { type: Number, required: true },
    taxCounty: { type: String, default: '' },
    tax: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    amountCents: { type: Number, required: true },
    protectionChecked: { type: Boolean, default: false },
    afterHoursChecked: { type: Boolean, default: false },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'canceled'],
      default: 'pending',
    },
    paymentIntentId: { type: String, default: null, index: true },
    receiptUrl: { type: String, default: null },
    paidAt: { type: Date, default: null },
    failureMessage: { type: String, default: null },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customer: { type: customerSchema, required: true },
    rental: { type: rentalSchema, required: true },
    lineItems: { type: [lineItemSchema], required: true },
    totals: { type: totalsSchema, required: true },
    payment: { type: paymentSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
