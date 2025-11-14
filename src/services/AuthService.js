const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validateLoginData, validateRegistrationData, sanitizeEmail } = require('../utils/validation');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'change_me';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'change_me_refresh';
    this.accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';
  }

  // Register a new user
  async register(userData) {
    try {
      // Validate input data
      const validationErrors = validateRegistrationData(userData);
      if (validationErrors.length > 0) {
        throw new ValidationError('Validation failed', validationErrors);
      }

      // Sanitize email
      const email = sanitizeEmail(userData.email);
      
      // Create user
      const user = await User.create({
        email,
        password: userData.password
      });

      return {
        success: true,
        message: 'Account created successfully! You can now log in with your credentials.',
        user: user.toSafeObject()
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      if (error.message === 'User already exists') {
        throw new ValidationError('Registration failed', [
          { field: 'email', message: 'An account with this email already exists' }
        ]);
      }
      
      console.error('Registration error:', error);
      throw new Error('Registration failed. Please try again.');
    }
  }

  // Login user
  async login(credentials) {
    try {
      // Validate input data
      const validationErrors = validateLoginData(credentials);
      if (validationErrors.length > 0) {
        throw new ValidationError('Validation failed', validationErrors);
      }

      // Sanitize email
      const email = sanitizeEmail(credentials.email);
      
      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Verify password
      const isValidPassword = await user.verifyPassword(credentials.password);
      if (!isValidPassword) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Generate tokens
      const tokens = this.generateTokens(user);

      return {
        success: true,
        user: user.toSafeObject(),
        ...tokens
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        throw error;
      }
      
      console.error('Login error:', error);
      throw new Error('Login failed. Please try again.');
    }
  }

  // Generate access and refresh tokens
  generateTokens(user) {
    const payload = {
      userId: user.id,
      email: user.email
    };

    const accessToken = jwt.sign(
      payload,
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry }
    );

    const refreshToken = jwt.sign(
      payload,
      this.jwtRefreshSecret,
      { expiresIn: this.refreshTokenExpiry }
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiry: this.accessTokenExpiry,
      refreshTokenExpiry: this.refreshTokenExpiry
    };
  }

  // Verify access token
  async verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        throw new AuthenticationError('User not found');
      }
      
      return user;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError('Access token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid access token');
      }
      throw error;
    }
  }

  // Verify refresh token
  async verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtRefreshSecret);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        throw new AuthenticationError('User not found');
      }
      
      return user;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid refresh token');
      }
      throw error;
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken) {
    try {
      const user = await this.verifyRefreshToken(refreshToken);
      const tokens = this.generateTokens(user);
      
      return {
        success: true,
        ...tokens
      };
    } catch (error) {
      if (error instanceof TokenExpiredError || error instanceof AuthenticationError) {
        throw error;
      }
      
      console.error('Token refresh error:', error);
      throw new Error('Failed to refresh token');
    }
  }

  // Get user profile
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }
      
      return user.toSafeObject();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      
      console.error('Get user profile error:', error);
      throw new Error('Failed to get user profile');
    }
  }

  // Logout (mainly for clearing server-side sessions if needed)
  async logout() {
    // For httpOnly cookies, the main logout logic is handled in the controller
    // This method can be extended for additional cleanup if needed
    return { success: true };
  }
}

// Custom error classes
class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class TokenExpiredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

module.exports = {
  AuthService,
  ValidationError,
  AuthenticationError,
  TokenExpiredError
};