# Auth Backend Service

A clean, production-ready Express.js authentication backend with PostgreSQL support and dual-environment capabilities.

## 🚀 Quick Start

### Development (Default)
```bash
npm run dev
# Runs on: http://localhost:4000 (auto-finds available port)
# Database: Mock data (no DB required)
```

### Local with Database
```bash
npm run dev:local
# Runs on: http://localhost:4000
# Database: Local PostgreSQL required
```

### Production
```bash
npm run prod
# Environment: Production
# Database: AWS RDS required
```

## ⚙️ Environment Management

### Organized Configuration
```
backend/
├── config/
│   ├── config-manager.js     # Smart config loader
│   └── environments/         # All env files
│       ├── .env.development  # Dev settings
│       ├── .env.local       # Local DB settings
│       └── .env.production  # Production settings
└── .env                     # Active config
```

### Easy Setup
```bash
# Windows
setup.bat          # Development
setup.bat local    # Local with DB
setup.bat prod     # Production

# NPM Scripts
npm run config:list      # Show available configs
npm run config:validate  # Validate current config
```

## 🔧 API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/health` | Health check | No |
| POST | `/api/register` | User registration | No |
| POST | `/api/login` | User authentication | No |
| GET | `/api/me` | Get current user | Yes |
| POST | `/api/logout` | Clear auth cookie | No |

## 🔐 Authentication Flow

1. **Login**: POST `/api/login` with email/password
2. **Cookie Set**: JWT token in HTTP-only cookie
3. **Access**: Token automatically sent with requests
4. **Verify**: `/api/me` validates token
5. **Logout**: POST `/api/logout` clears cookie

## 🌍 Environment Features

### Development Mode
- ✅ Runs without database (mock data)
- ✅ Auto-finds available port
- ✅ Detailed logging
- ✅ Insecure cookies for localhost

### Production Mode
- ✅ Requires database connection
- ✅ Secure cookies with HTTPS
- ✅ Production-optimized settings
- ✅ Environment validation

## 🛡️ Security

- JWT tokens with 8-hour expiration
- HTTP-only cookies (XSS protection)
- Secure cookies in production
- SameSite cookies (CSRF protection)
- Password hashing with bcrypt
- Environment-specific security settings

## 📋 Configuration

Environment variables are organized in `/config/environments/`:

**Development**: Mock data, localhost settings
**Local**: Real database, localhost settings  
**Production**: AWS RDS, secure settings

The system automatically:
- Loads correct environment
- Validates required variables
- Shows safe configuration summary
- Handles port conflicts
- Provides fallback options

## 🚢 Deployment

### Render.com
The backend is configured for Render deployment with `render.yaml`. Set these environment variables in Render:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Strong secret for JWT signing
- `NODE_ENV=production`
