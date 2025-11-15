const { AuthService, TokenExpiredError, AuthenticationError } = require('../services/AuthService');
const { extractTokensFromCookies } = require('../utils/cookies');

class AuthMiddleware {
  constructor() {
    this.authService = new AuthService();
  }

  // Middleware to verify access token
  verifyToken = async (req, res, next) => {
    try {
      // Get token from Authorization header (Bearer token)
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access token required',
          code: 'NO_TOKEN'
        });
      }

      try {
        // Verify access token
        const user = await this.authService.verifyAccessToken(token);
        req.user = user;
        next();
      } catch (error) {
        if (error instanceof TokenExpiredError) {
          return res.status(401).json({
            success: false,
            message: 'Access token expired',
            code: 'TOKEN_EXPIRED'
          });
        }
        
        if (error instanceof AuthenticationError) {
          return res.status(401).json({
            success: false,
            message: error.message,
            code: 'INVALID_TOKEN'
          });
        }

        throw error;
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication verification failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // Optional middleware for routes that work with or without authentication
  optionalAuth = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        // No token, continue without user
        req.user = null;
        return next();
      }

      try {
        const user = await this.authService.verifyAccessToken(token);
        req.user = user;
      } catch (error) {
        // Invalid/expired token, continue without user
        req.user = null;
      }
      
      next();
    } catch (error) {
      console.error('Optional auth middleware error:', error);
      // Continue without user on error
      req.user = null;
      next();
    }
  };

  // Middleware to check if user is admin (example for future use)
  requireAdmin = async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // For now, check if user has admin email or role
      // This can be extended based on your user model
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim());
      
      if (!adminEmails.includes(req.user.email)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      next();
    } catch (error) {
      console.error('Admin middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization verification failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // Rate limiting middleware (simple implementation)
  rateLimiter = (maxRequests = 10, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();
    const isDev = process.env.NODE_ENV !== 'production';

    return (req, res, next) => {
      // In development, be more lenient or skip rate limiting for certain requests
      if (isDev && process.env.DISABLE_RATE_LIMIT === 'true') {
        return next();
      }

      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old entries periodically
      if (requests.size > 1000) { // Prevent memory leak
        for (const [key, timestamps] of requests.entries()) {
          const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
          if (validTimestamps.length === 0) {
            requests.delete(key);
          } else {
            requests.set(key, validTimestamps);
          }
        }
      }

      // Check current IP
      const ipRequests = requests.get(ip) || [];
      const recentRequests = ipRequests.filter(timestamp => timestamp > windowStart);

      if (recentRequests.length >= maxRequests) {
        const retryAfter = Math.ceil((recentRequests[0] + windowMs - now) / 1000);
        
        if (isDev) {
          console.warn(`Rate limit hit for IP ${ip}: ${recentRequests.length}/${maxRequests} requests`);
        }
        
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter,
          limit: maxRequests,
          windowMs: Math.ceil(windowMs / 1000),
          current: recentRequests.length
        });
      }

      // Add current request
      recentRequests.push(now);
      requests.set(ip, recentRequests);

      next();
    };
  };
}

// Export instance for use in routes
const authMiddleware = new AuthMiddleware();

module.exports = {
  AuthMiddleware,
  authMiddleware
};