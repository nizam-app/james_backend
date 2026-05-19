const express = require('express');
const rateLimit = require('express-rate-limit');
const { asyncHandler } = require('../utils/asyncHandler');
const { createPaymentIntent } = require('../controllers/payment.controller');

const router = express.Router();

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many payment attempts. Please try again later.' },
});

router.post(
  '/create-payment-intent',
  paymentLimiter,
  asyncHandler(createPaymentIntent)
);

module.exports = router;
