const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

/**
 * Configuration Manager
 * Handles loading environment variables from organized config files
 */
class ConfigManager {
  constructor() {
    this.configDir = path.join(__dirname, 'environments');
    this.loadedConfig = null;
  }

  /**
   * Load environment configuration
   * @param {string} environment - 'development', 'production', 'local', or 'auto'
   */
  loadConfig(environment = 'auto') {
    try {
      // Auto-detect environment if not specified
      if (environment === 'auto') {
        environment = process.env.NODE_ENV || 'development';
      }

      const configFile = `.env.${environment}`;
      const configPath = path.join(this.configDir, configFile);

      // Check if config file exists
      if (!fs.existsSync(configPath)) {
        console.warn(`⚠️  Config file not found: ${configFile}`);
        console.warn(`📂 Looking in: ${this.configDir}`);
        console.warn(`🔄 Falling back to development config`);
        
        // Fallback to development
        const fallbackPath = path.join(this.configDir, '.env.development');
        if (fs.existsSync(fallbackPath)) {
          dotenv.config({ path: fallbackPath });
        }
        return;
      }

      // Load the configuration
      const result = dotenv.config({ path: configPath });
      
      if (result.error) {
        throw result.error;
      }

      this.loadedConfig = {
        environment,
        configFile,
        configPath,
        loadedAt: new Date().toISOString()
      };

      console.log(`✅ Loaded config: ${configFile}`);
      console.log(`📂 From: ${configPath}`);
      
    } catch (error) {
      console.error('❌ Failed to load configuration:', error.message);
      throw error;
    }
  }

  /**
   * Get configuration info
   */
  getConfigInfo() {
    return this.loadedConfig;
  }

  /**
   * List available environment files
   */
  listAvailableConfigs() {
    try {
      const files = fs.readdirSync(this.configDir)
        .filter(file => file.startsWith('.env.'))
        .map(file => file.replace('.env.', ''));
      
      return files;
    } catch (error) {
      console.error('Failed to list config files:', error.message);
      return [];
    }
  }

  /**
   * Validate required environment variables
   */
  validateConfig() {
    const required = ['NODE_ENV', 'PORT', 'JWT_SECRET', 'FRONTEND_ORIGIN'];
    const missing = [];

    for (const key of required) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing);
      return false;
    }

    console.log('✅ All required environment variables are set');
    return true;
  }

  /**
   * Find available port starting from preferred port
   */
  async findAvailablePort(preferredPort = 4000) {
    const net = require('net');
    
    const isPortAvailable = (port) => {
      return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.close(() => resolve(true));
        });
        server.on('error', () => resolve(false));
      });
    };

    for (let port = preferredPort; port < preferredPort + 10; port++) {
      if (await isPortAvailable(port)) {
        return port;
      }
    }
    
    throw new Error(`No available ports found in range ${preferredPort}-${preferredPort + 9}`);
  }

  /**
   * Display current configuration (safe - no secrets)
   */
  displayConfig() {
    const config = {
      environment: process.env.NODE_ENV,
      port: process.env.PORT,
      frontendOrigin: process.env.FRONTEND_ORIGIN,
      databaseConfigured: !!process.env.DATABASE_URL || !!process.env.DB_HOST,
      sslEnabled: process.env.DB_SSL === 'true',
      cookieDomain: process.env.COOKIE_DOMAIN || 'not set'
    };

    console.log('📋 Current Configuration:');
    console.table(config);
  }
}

module.exports = new ConfigManager();