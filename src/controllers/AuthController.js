const { AuthService, ValidationError, AuthenticationError, TokenExpiredError } = require('../services/AuthService');
const { generateCookieOptions } = require('../utils/cookies');

class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  // Register new user
  register = async (req, res) => {
    try {
      const result = await this.authService.register(req.body);
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors
        });
      }
      
      console.error('Registration controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // Login user
  login = async (req, res) => {
    try {
      const result = await this.authService.login(req.body);
      
      // Set httpOnly cookies for tokens
      const cookieOptions = generateCookieOptions();
      
      // Set access token cookie (shorter expiry)
      res.cookie('accessToken', result.accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000 // 15 minutes
      });
      
      // Set refresh token cookie (longer expiry)
      res.cookie('refreshToken', result.refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Return user data without tokens (since they're in cookies)
      res.json({
        success: result.success,
        user: result.user,
        message: 'Login successful'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors
        });
      }
      
      if (error instanceof AuthenticationError) {
        return res.status(401).json({
          success: false,
          message: error.message
        });
      }
      
      console.error('Login controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // Get current user profile
  getProfile = async (req, res) => {
    try {
      // User is already attached to req by auth middleware
      const user = req.user;
      
      res.json({
        success: true,
        user: user.toSafeObject()
      });
    } catch (error) {
      console.error('Get profile controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user profile',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // Refresh access token
  refreshToken = async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token not found'
        });
      }
      
      const result = await this.authService.refreshAccessToken(refreshToken);
      
      // Set new access token cookie
      const cookieOptions = generateCookieOptions();
      res.cookie('accessToken', result.accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000 // 15 minutes
      });
      
      res.json({
        success: true,
        message: 'Token refreshed successfully'
      });
    } catch (error) {
      if (error instanceof TokenExpiredError || error instanceof AuthenticationError) {
        // Clear cookies if refresh token is invalid/expired
        this.clearAuthCookies(res);
        
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please login again.'
        });
      }
      
      console.error('Refresh token controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh token',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // Logout user
  logout = async (req, res) => {
    try {
      await this.authService.logout();
      
      // Clear cookies
      this.clearAuthCookies(res);
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout controller error:', error);
      
      // Even if there's an error, still clear cookies
      this.clearAuthCookies(res);
      
      res.status(500).json({
        success: false,
        message: 'Logout completed with warnings',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // Verify token endpoint
  verifyToken = async (req, res) => {
    try {
      // If we reach here, token is valid (auth middleware passed)
      res.json({
        success: true,
        valid: true,
        user: req.user.toSafeObject()
      });
    } catch (error) {
      console.error('Verify token controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify token',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // Helper method to clear authentication cookies
  clearAuthCookies(res) {
    const cookieOptions = generateCookieOptions();
    
    // Clear access token cookie
    res.cookie('accessToken', '', {
      ...cookieOptions,
      maxAge: 0
    });
    
    // Clear refresh token cookie
    res.cookie('refreshToken', '', {
      ...cookieOptions,
      maxAge: 0
    });
  }
}

module.exports = AuthController;