const { AuthService, TokenExpiredError, AuthenticationError } = require('../services/AuthService');
const { extractTokensFromCookies } = require('../utils/cookies');

class AuthMiddleware {
  constructor() {
    this.authService = new AuthService();
  }

  // Middleware to verify access token
  verifyToken = async (req, res, next) => {
    try {
      const { accessToken, refreshToken } = extractTokensFromCookies(req);

      if (!accessToken) {
        return res.status(401).json({
          success: false,
          message: 'Access token required',
          code: 'NO_TOKEN'
        });
      }

      try {
        // Verify access token
        const user = await this.authService.verifyAccessToken(accessToken);
        req.user = user;
        next();
      } catch (error) {
        if (error instanceof TokenExpiredError) {
          // Access token expired, try to refresh if refresh token exists
          if (refreshToken) {
            return res.status(401).json({
              success: false,
              message: 'Access token expired',
              code: 'TOKEN_EXPIRED'
            });
          } else {
            return res.status(401).json({
              success: false,
              message: 'Access token expired and no refresh token available',
              code: 'SESSION_EXPIRED'
            });
          }
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
      const { accessToken } = extractTokensFromCookies(req);

      if (!accessToken) {
        // No token, continue without user
        req.user = null;
        return next();
      }

      try {
        const user = await this.authService.verifyAccessToken(accessToken);
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

    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old entries
      for (const [key, timestamps] of requests.entries()) {
        const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
        if (validTimestamps.length === 0) {
          requests.delete(key);
        } else {
          requests.set(key, validTimestamps);
        }
      }

      // Check current IP
      const ipRequests = requests.get(ip) || [];
      const recentRequests = ipRequests.filter(timestamp => timestamp > windowStart);

      if (recentRequests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
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