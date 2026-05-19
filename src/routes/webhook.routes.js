const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { handleStripeWebhook } = require('../controllers/webhook.controller');

const router = express.Router();

router.post('/', asyncHandler(handleStripeWebhook));

module.exports = router;
