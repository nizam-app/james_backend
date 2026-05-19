const {
  DELIVERY_FEE,
  PICKUP_FEE,
  AFTER_HOURS_DISPATCH_FEE,
  PROTECTION_RATE,
  resolveCartLine,
} = require('./priceCatalog');

const ZIP_FLAGLER = new Set([
  '32110', '32135', '32136', '32137', '32142', '32143', '32164',
]);
const ZIP_VOLUSIA = new Set([
  '32102', '32112', '32114', '32115', '32116', '32117', '32118', '32119',
  '32120', '32121', '32122', '32123', '32124', '32125', '32126', '32127',
  '32128', '32129', '32130', '32132', '32141', '32168', '32169', '32170',
  '32173', '32174', '32175', '32176', '32180', '32187', '32189', '32190',
  '32191', '32192', '32193', '32195', '32198',
]);
const ZIP_ST_JOHNS = new Set([
  '32004', '32033', '32080', '32081', '32082', '32084', '32085', '32086',
  '32092', '32095', '32259',
]);

function normalizeZip(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '').slice(0, 5);
  return digits.length === 5 ? digits : '';
}

function getTaxRateForZip(zip5) {
  if (ZIP_FLAGLER.has(zip5)) return 0.07;
  if (ZIP_VOLUSIA.has(zip5)) return 0.065;
  if (ZIP_ST_JOHNS.has(zip5)) return 0.07;
  return 0.07;
}

function calculateRentalDays(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'Invalid rental dates' };
  }
  if (end < start) {
    return { error: 'End date must be on or after start date' };
  }
  const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return { rentalDays: Math.max(1, diff) };
}

/**
 * Recalculate order totals from cart + options. Does not trust client prices.
 */
function calculateTotals({
  cart,
  startDate,
  endDate,
  zip,
  protectionChecked = false,
  afterHoursChecked = false,
}) {
  if (!Array.isArray(cart) || cart.length === 0) {
    return { error: 'Cart is empty' };
  }

  const zip5 = normalizeZip(zip);
  if (!zip5) {
    return { error: 'Valid 5-digit ZIP code is required' };
  }

  const daysResult = calculateRentalDays(startDate, endDate);
  if (daysResult.error) {
    return { error: daysResult.error };
  }
  const { rentalDays } = daysResult;

  const lineItems = [];
  let subtotal = 0;
  let protectionEligibleSubtotal = 0;

  for (const item of cart) {
    const resolved = resolveCartLine(item, rentalDays);
    if (resolved.skip) {
      continue;
    }
    if (resolved.error) {
      return { error: resolved.error };
    }
    const { line } = resolved;
    lineItems.push(line);
    subtotal += line.lineTotal;
    if (line.protectionEligible) {
      protectionEligibleSubtotal += line.lineTotal;
    }
  }

  if (lineItems.length === 0) {
    return { error: 'No billable items in cart' };
  }

  subtotal = Math.round(subtotal * 100) / 100;
  protectionEligibleSubtotal = Math.round(protectionEligibleSubtotal * 100) / 100;

  const deliveryFee = DELIVERY_FEE;
  const pickupFee = PICKUP_FEE;
  const afterHoursDispatchFee = afterHoursChecked ? AFTER_HOURS_DISPATCH_FEE : 0;

  const protectionFee = protectionChecked
    ? Math.round(protectionEligibleSubtotal * PROTECTION_RATE * 100) / 100
    : 0;

  const taxRate = getTaxRateForZip(zip5);
  const taxable = subtotal + deliveryFee + pickupFee;
  const tax = Math.round(taxable * taxRate * 100) / 100;

  const grandTotal = Math.round(
    (subtotal +
      deliveryFee +
      pickupFee +
      afterHoursDispatchFee +
      protectionFee +
      tax) *
      100
  ) / 100;

  const amountCents = Math.round(grandTotal * 100);
  if (amountCents < 50) {
    return { error: 'Order total must be at least $0.50' };
  }

  return {
    rentalDays,
    zip: zip5,
    taxRate,
    taxCounty:
      ZIP_FLAGLER.has(zip5)
        ? 'Flagler'
        : ZIP_VOLUSIA.has(zip5)
          ? 'Volusia'
          : ZIP_ST_JOHNS.has(zip5)
            ? 'St. Johns'
            : 'Default',
    lineItems,
    subtotal,
    deliveryFee,
    pickupFee,
    afterHoursDispatchFee,
    protectionEligibleSubtotal,
    protectionFee,
    protectionChecked: Boolean(protectionChecked),
    afterHoursChecked: Boolean(afterHoursChecked),
    tax,
    grandTotal,
    amountCents,
  };
}

module.exports = {
  normalizeZip,
  getTaxRateForZip,
  calculateRentalDays,
  calculateTotals,
};
