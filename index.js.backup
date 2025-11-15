const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

// Load configuration using our config manager
const configManager = require('./config/config-manager');

// Initialize configuration
const environment = process.argv.includes('--prod') ? 'production' : 
                   process.argv.includes('--local') ? 'local' : 'auto';
configManager.loadConfig(environment);

// Validate configuration
if (!configManager.validateConfig()) {
  process.exit(1);
}

// Get environment info after config is loaded
const isDev = process.env.NODE_ENV !== 'production';
const db = require('./db');

// Debug utility (defined after config is loaded)
const debug = {
  log: (...args) => {
    if (isDev && process.env.ENABLE_DEBUG === 'true') {
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args) => {
    console.error(...args);
  }
};

// Display configuration (safe - no secrets)
configManager.displayConfig();

// Initialize Express app
const app = express();

// Configuration
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

// Middleware
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Utility functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const generateCookieOptions = () => {
  const options = {
    httpOnly: true,
    secure: !isDev, // true in production (HTTPS required)
    sameSite: isDev ? 'lax' : 'none', // 'none' for cross-origin in production
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    path: '/',
  };

  // In production, don't set domain for Render.com subdomains
  // Let the cookie be set for the exact domain
  // const cookieDomain = process.env.COOKIE_DOMAIN;
  // if (!isDev && cookieDomain) {
  //   options.domain = cookieDomain;
  // }

  return options;
};

const parseCookies = (cookieHeader) => {
  return cookieHeader
    .split(';')
    .map(c => c.trim())
    .filter(Boolean)
    .reduce((acc, cur) => {
      const [k, ...v] = cur.split('=');
      acc[k] = decodeURIComponent(v.join('='));
      return acc;
    }, {});
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: isDev ? 'development' : 'production',
    timestamp: new Date().toISOString()
  });
});

// Registration handler used by both /api/register and /user/register
async function handleRegister(req, res) {
  const { email, password } = req.body || {};
  const errors = [];

  // Validation
  if (!email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!validateEmail(email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (password.length < 6) {
    errors.push({ field: 'password', message: 'Password must be at least 6 characters' });
  }

  if (errors.length) {
    return res.status(400).json({ errors });
  }

  try {
    let user;
    
    if (isDev) {
      // Development mode: try DB first, fallback to mock user
      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query(
          'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at',
          [email, hashedPassword]
        );
        user = result.rows[0];
      } catch (dbErr) {
        if (dbErr.code === '23505') {
          return res.status(409).json({ error: 'User already exists' });
        }
        debug.warn('DB query failed in dev mode, using mock user for registration');
        user = { 
          id: Math.floor(Math.random() * 1000), 
          email, 
          created_at: new Date().toISOString()
        };
        debug.log('Created mock user for registration:', user);
      }
    } else {
      // Production mode: require DB
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await db.query(
        'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at',
        [email, hashedPassword]
      );
      user = result.rows[0];
    }

    debug.log(`User registered: ${user.email}`);
    res.status(201).json({ 
      user,
      message: 'Account created successfully! You can now log in with your credentials.'
    });
  } catch (err) {
    debug.error('Registration error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'User already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Register endpoints
app.post('/api/register', handleRegister);
app.post('/user/register', handleRegister);

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    let user = null;
    
    if (isDev) {
      // Development mode: try DB first, fallback to mock user
      try {
        const result = await db.query('SELECT id, email, password FROM users WHERE email = $1', [email]);
        user = result.rows[0];
        
        if (user) {
          const isValidPassword = await bcrypt.compare(password, user.password);
          if (!isValidPassword) {
            return res.status(401).json({ error: 'Incorrect password. Please check your password and try again.' });
          }
        }
      } catch (dbErr) {
        debug.warn('DB query failed in dev mode, using mock user');
        user = { id: 1, email };
        debug.log('Using mock user for login:', user);
      }
    } else {
      // Production mode: require DB
      const result = await db.query('SELECT id, email, password FROM users WHERE email = $1', [email]);
      user = result.rows[0];
      
      if (!user) {
        return res.status(401).json({ error: 'No account found with this email address. Please check your email or create a new account.' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Incorrect password. Please check your password and try again.' });
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Authentication failed. Please check your email and password.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '8h' }
    );
    
    // Set cookie with appropriate options
    const cookieOptions = generateCookieOptions();
    res.cookie('token', token, cookieOptions);

    debug.log(`Login successful for ${user.email}`);
    res.json({ ok: true, user: { id: user.id, email: user.email } });
  } catch (err) {
    debug.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token and return user info
app.get('/api/me', async (req, res) => {
  try {
    // Parse cookies from request
    const cookieHeader = req.headers.cookie || '';
    const cookies = parseCookies(cookieHeader);
    const token = cookies.token;
    
    if (!token) {
      return res.status(401).json({ error: 'Missing token cookie' });
    }

    // Verify JWT token
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    let user = null;

    if (isDev) {
      // Development mode: try DB first, fallback to mock user
      try {
        const result = await db.query('SELECT id, email, created_at FROM users WHERE id = $1', [payload.userId]);
        user = result.rows[0];
      } catch (dbErr) {
        debug.warn('DB query failed in dev mode, using mock user from token');
        user = { 
          id: payload.userId, 
          email: payload.email, 
          created_at: new Date().toISOString()
        };
      }
    } else {
      // Production mode: require DB
      const result = await db.query('SELECT id, email, created_at FROM users WHERE id = $1', [payload.userId]);
      user = result.rows[0];
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    debug.log(`Token verified for ${user.email}`);
    res.json({ user });
  } catch (err) {
    debug.error('Auth verification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint (clear cookie)
app.post('/api/logout', (req, res) => {
    debug.log(`Logout request`);
    const cookieOptions = generateCookieOptions();
    cookieOptions.maxAge = 0; // Clear the cookie
    res.cookie('token', '', cookieOptions);
    res.json({ ok: true });
});


// Start server with environment-aware DB connectivity check
async function startServer() {
  debug.log(`Starting server in ${isDev ? 'development' : 'production'} mode...`);
  
  if (!isDev) {
    // Production mode: require DB connection
    try {
      await db.query('SELECT 1');
      console.log('✅ Postgres connection: OK');
    } catch (err) {
      console.error('❌ Postgres connection: FAILED');
      console.error(err);
      console.error('Backend will exit. Please check your DB settings in .env');
      process.exit(1);
    }
  } else {
    // Development mode: try to connect but don't fail if it's not available
    try {
      await db.query('SELECT 1');
      console.log('✅ Postgres connection: OK');
    } catch (err) {
      debug.warn('⚠️  Postgres connection: FAILED (continuing in dev mode)');
      debug.warn('Database operations will fail. Set up local DB or use production env.');
    }
  }

  // Find available port (useful for development)
  let serverPort = PORT;
  if (isDev) {
    try {
      const availablePort = await configManager.findAvailablePort(parseInt(PORT));
      if (availablePort !== parseInt(PORT)) {
        debug.log(`⚠️  Port ${PORT} is busy, using port ${availablePort} instead`);
        serverPort = availablePort;
      }
    } catch (err) {
      console.error('❌ Could not find available port:', err.message);
      process.exit(1);
    }
  }

  app.listen(serverPort, () => {
    console.log(`🚀 Auth backend running on http://localhost:${serverPort}`);
    console.log(`📦 Environment: ${isDev ? 'development' : 'production'}`);
    console.log(`🌐 CORS enabled for: ${FRONTEND_ORIGIN}`);
    console.log(`🔐 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
    
    if (serverPort !== parseInt(PORT)) {
      console.log(`📌 Note: Using port ${serverPort} instead of configured port ${PORT}`);
    }

    // Environment-specific deployment notes
    if (!isDev) {
      console.log('⚠️  PRODUCTION MODE: This should be deployed to render.com, not run locally!');
      console.log('🌍 Production URL should be: https://ex-awad-registration-be.onrender.com');
      console.log('💡 For local development, use: npm run dev');
    } else {
      console.log('🏠 DEVELOPMENT MODE: Perfect for local testing');
      console.log('💡 Frontend should connect to: http://localhost:' + serverPort);
    }
  });
}

// Start the server
startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
