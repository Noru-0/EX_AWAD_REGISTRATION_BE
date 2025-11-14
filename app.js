const express = require('express');
const cors = require('cors');
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

// Import routes after config is loaded
const apiRoutes = require('./src/routes');

// Get environment info after config is loaded
const isDev = process.env.NODE_ENV !== 'production';

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
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

// Global middleware
app.use(cors({ 
  origin: FRONTEND_ORIGIN, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging middleware (development)
if (isDev) {
  app.use((req, res, next) => {
    debug.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// API routes
app.use('/api', apiRoutes);

// Backward compatibility routes
app.use('/user', apiRoutes);

// Global error handler
app.use((error, req, res, next) => {
  debug.error('Unhandled error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: isDev ? error.stack : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server with environment-aware DB connectivity check
async function startServer() {
  debug.log(`Starting server in ${isDev ? 'development' : 'production'} mode...`);
  
  // Import database after config is loaded
  const db = require('./db');
  
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
    console.log(`🔐 JWT Tokens: httpOnly cookies enabled`);
    console.log(`🏗️  Architecture: MVC pattern`);
    
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
      console.log('📊 API endpoints available:');
      console.log('   POST /api/auth/register - Register new user');
      console.log('   POST /api/auth/login - Login user');
      console.log('   GET /api/auth/me - Get user profile');
      console.log('   POST /api/auth/logout - Logout user');
      console.log('   POST /api/auth/refresh - Refresh access token');
      console.log('   GET /api/health - Health check');
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;