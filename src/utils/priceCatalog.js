/**
 * Server-side price catalog. Frontend prices are not trusted.
 * Names are matched after normalization (lowercase, collapsed whitespace).
 */

const DELIVERY_FEE = 85;
const PICKUP_FEE = 85;
const AFTER_HOURS_DISPATCH_FEE = 125;
const PROTECTION_RATE = 0.15;

/** per_day: daily rate in USD */
const PER_DAY_CATALOG = [
  { patterns: ['commercial dehumidifier'], price: 115 },
  { patterns: ['centrifugal air mover', 'air mover (centrifugal)'], price: 28 },
  { patterns: ['axial air mover'], price: 35 },
  { patterns: ['standard professional moisture meter'], price: 45 },
  { patterns: ['moisture meter'], price: 85, exact: true },
  { patterns: ['hepa air scrubber'], price: 175 },
  { patterns: ['100ft heavy duty extension cord', 'extension cord'], price: 10 },
  {
    patterns: [
      '100ft power reel',
      'power reel w/ 4 gfci',
      'heavy duty power reel',
    ],
    price: 18,
  },
  { patterns: ['hardwood floor mat system'], price: 180 },
];

/** flat: one-time charge in USD */
const FLAT_CATALOG = [
  {
    patterns: [
      'equipment set-up',
      'equipment setup',
      'set-up / take-down',
      'setup & takedown',
      'setup and takedown',
    ],
    price: 300,
  },
  {
    patterns: ['immediate dispatch deposit', 'dispatch deposit'],
    price: 300,
  },
  { patterns: ['delivery fee'], price: 85 },
  { patterns: ['pickup fee', 'retrieval fee', 'equipment retrieval'], price: 85 },
];

/** Allowed $/SF rates by service category */
const WATER_EXTRACTION_RATES = [0.46, 0.72, 0.88, 1.35];
const ANTIMICROBIAL_RATES = [0.34, 0.48];

const PROTECTION_PLAN_NAMES = [
  'equipment protection plan (15%)',
  'damage protection (15%)',
];

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function nameMatchesPatterns(normalized, patterns, exact = false) {
  return patterns.some((pattern) => {
    const p = pattern.toLowerCase();
    if (exact) return normalized === p;
    return normalized === p || normalized.includes(p);
  });
}

function findPerDayPrice(normalizedName) {
  for (const entry of PER_DAY_CATALOG) {
    if (nameMatchesPatterns(normalizedName, entry.patterns, entry.exact)) {
      return entry.price;
    }
  }
  return null;
}

function findFlatPrice(normalizedName) {
  for (const entry of FLAT_CATALOG) {
    if (nameMatchesPatterns(normalizedName, entry.patterns)) {
      return entry.price;
    }
  }
  return null;
}

function isProtectionPlanItem(normalizedName) {
  return PROTECTION_PLAN_NAMES.some(
    (n) => normalizedName === n || normalizedName.includes('protection plan')
  );
}

function isWaterExtractionItem(normalizedName) {
  return (
    normalizedName.includes('water extraction') ||
    normalizedName.includes('water extract')
  );
}

function isAntimicrobialItem(normalizedName) {
  return (
    normalizedName.includes('anti-microbial') ||
    normalizedName.includes('antimicrobial') ||
    normalizedName.includes('anti microbial')
  );
}

function isProtectionEligible(normalizedName) {
  const excluded = [
    'equipment setup',
    'equipment set-up',
    'set-up / take-down',
    'setup & takedown',
    'water extraction',
    'water extract',
    'anti-microbial',
    'antimicrobial',
    'delivery fee',
    'pickup fee',
    'retrieval fee',
    'immediate dispatch',
    'dispatch deposit',
  ];
  if (excluded.some((p) => normalizedName.includes(p))) {
    return false;
  }
  const eligible = [
    'air mover',
    'dehumidifier',
    'hepa air scrubber',
    'moisture meter',
    'power reel',
    'extension cord',
    'hardwood floor mat',
  ];
  return eligible.some((p) => normalizedName.includes(p));
}

function resolvePerSfRate(item, normalizedName) {
  const rate = Number(item.ratePerSf);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { error: `Invalid rate for ${item.name}` };
  }

  if (isWaterExtractionItem(normalizedName)) {
    if (!WATER_EXTRACTION_RATES.includes(rate)) {
      return { error: `Invalid water extraction rate: ${rate}` };
    }
    return { rate };
  }

  if (isAntimicrobialItem(normalizedName)) {
    if (!ANTIMICROBIAL_RATES.includes(rate)) {
      return { error: `Invalid anti-microbial rate: ${rate}` };
    }
    return { rate };
  }

  // Cart upsell "Water Extraction" / "Anti-Microbial Treatment" without service subtype
  if (normalizedName === 'water extraction') {
    if (rate !== 0.46) {
      return { error: 'Water Extraction must use catalog rate $0.46/SF' };
    }
    return { rate: 0.46 };
  }
  if (normalizedName.includes('anti-microbial treatment')) {
    if (rate !== 0.34) {
      return { error: 'Anti-Microbial Treatment must use catalog rate $0.34/SF' };
    }
    return { rate: 0.34 };
  }

  return { error: `Unknown per-SF item: ${item.name}` };
}

/**
 * Resolve a cart line to server-trusted pricing.
 * @returns {{ line: object } | { error: string }}
 */
function resolveCartLine(item, rentalDays) {
  const name = String(item.name || '').trim();
  if (!name) {
    return { error: 'Cart item missing name' };
  }

  const normalized = normalizeName(name);

  if (isProtectionPlanItem(normalized)) {
    return { skip: true };
  }

  // Delivery and pickup are always applied once in calculateTotals (not from cart lines)
  if (
    normalized.includes('delivery fee') ||
    normalized.includes('pickup fee') ||
    normalized.includes('retrieval fee') ||
    (normalized.includes('equipment retrieval') && normalized.includes('pickup'))
  ) {
    return { skip: true };
  }

  // Quote-only items
  if (normalized.includes('ozone') && normalized.includes('quote')) {
    return { error: `${name} requires a phone quote before checkout` };
  }

  const quantity = Math.max(1, Math.floor(Number(item.quantity || item.qty || 1)));
  const billingType = item.billingType || 'per_day';

  if (billingType === 'per_sf') {
    const sq = Math.floor(Number(item.squareFootage));
    if (!sq || sq <= 0 || sq > 1_000_000) {
      return { error: `Invalid square footage for ${name}` };
    }
    const rateResult = resolvePerSfRate(item, normalized);
    if (rateResult.error) {
      return { error: rateResult.error };
    }
    const lineTotal = Math.round(rateResult.rate * sq * 100) / 100;
    return {
      line: {
        name,
        billingType: 'per_sf',
        quantity: 1,
        ratePerSf: rateResult.rate,
        squareFootage: sq,
        unitPrice: rateResult.rate,
        lineTotal,
        protectionEligible: false,
      },
    };
  }

  if (billingType === 'flat') {
    const catalogPrice = findFlatPrice(normalized);
    if (catalogPrice == null) {
      return { error: `Unknown flat-rate item: ${name}` };
    }
    if (catalogPrice === 0) {
      return { error: `${name} cannot be purchased online` };
    }
    const lineTotal = Math.round(catalogPrice * quantity * 100) / 100;
    return {
      line: {
        name,
        billingType: 'flat',
        quantity,
        unitPrice: catalogPrice,
        lineTotal,
        protectionEligible: isProtectionEligible(normalized),
      },
    };
  }

  // per_day (default)
  const dayRate = findPerDayPrice(normalized);
  if (dayRate == null) {
    return { error: `Unknown rental item: ${name}` };
  }
  const days = Math.max(1, Math.floor(Number(rentalDays) || 1));
  const lineTotal = Math.round(dayRate * quantity * days * 100) / 100;
  return {
    line: {
      name,
      billingType: 'per_day',
      quantity,
      unitPrice: dayRate,
      rentalDays: days,
      lineTotal,
      protectionEligible: isProtectionEligible(normalized),
    },
  };
}

module.exports = {
  DELIVERY_FEE,
  PICKUP_FEE,
  AFTER_HOURS_DISPATCH_FEE,
  PROTECTION_RATE,
  normalizeName,
  isProtectionEligible,
  isProtectionPlanItem,
  resolveCartLine,
};
