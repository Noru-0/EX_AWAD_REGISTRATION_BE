const express = require('express');
const authRoutes = require('./auth');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Apply rate limiting to auth routes (more lenient in development)
const isDev = process.env.NODE_ENV !== 'production';
const rateLimitConfig = isDev 
  ? { maxRequests: 100, windowMs: 15 * 60 * 1000 } // 100 requests per 15 minutes in dev
  : { maxRequests: 20, windowMs: 15 * 60 * 1000 };  // 20 requests per 15 minutes in prod

router.use('/auth', authMiddleware.rateLimiter(rateLimitConfig.maxRequests, rateLimitConfig.windowMs));
router.use('/auth', authRoutes);

// Legacy routes for backward compatibility
router.use('/', authRoutes); // This allows /api/login, /api/register, etc.

// Protected routes example (can be extended)
router.get('/protected', authMiddleware.verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'This is a protected route',
    user: req.user.toSafeObject()
  });
});

// Optional auth route example
router.get('/public', authMiddleware.optionalAuth, (req, res) => {
  res.json({
    success: true,
    message: 'This is a public route',
    user: req.user ? req.user.toSafeObject() : null,
    authenticated: !!req.user
  });
});

module.exports = router;