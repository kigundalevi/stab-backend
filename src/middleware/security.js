const rateLimit = require('express-rate-limit');

const validatePin = (req, res, next) => {
  const { pin } = req.body;
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  }
  next();
};

const walletLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many wallet creations from this IP, please try again later'
});

const retrievalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit to 5 attempts per window
  message: 'Too many retrieval attempts, please try again later'
});

module.exports = { validatePin, walletLimiter, retrievalLimiter };