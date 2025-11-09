const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

dotenv.config();
const db = require('./db');

const app = express();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000'
const cookieParser = require('cookie-parser')
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser())

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Register new user
// registration handler used by both /api/register and /user/register
async function handleRegister(req, res) {
  const { email, password } = req.body || {};
  const errors = []
  if (!email) errors.push({ field: 'email', message: 'Email is required' })
  else {
    // basic email format check
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!re.test(email)) errors.push({ field: 'email', message: 'Invalid email format' })
  }
  if (!password) errors.push({ field: 'password', message: 'Password is required' })
  else if (password.length < 6) errors.push({ field: 'password', message: 'Password must be at least 6 characters' })

  if (errors.length) return res.status(400).json({ errors })

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, hashed]
    );
    const user = result.rows[0];
    // optional: create a token and set cookie for immediate auth
  // Do NOT auto-login on registration. Return created user and require an explicit login.
  // (Removing the cookie set here prevents automatic authentication immediately after register.)
  res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      // unique_violation
      return res.status(409).json({ error: 'User already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

app.post('/api/register', handleRegister)
app.post('/user/register', handleRegister)

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  try {
    const result = await db.query('SELECT id, email, password FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
    // set token as httpOnly cookie so middleware/edge can read it on the server
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
      path: '/',
    });

    res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token and return user info
app.get('/api/me', async (req, res) => {
  try {
    // Read token from cookies (middleware/edge and browser requests with credentials will send this)
    const cookieHeader = req.headers.cookie || '';
    const cookies = cookieHeader.split(';').map(c => c.trim()).filter(Boolean).reduce((acc, cur) => {
      const [k, ...v] = cur.split('=')
      acc[k] = decodeURIComponent(v.join('='))
      return acc
    }, {})
    const token = cookies.token
    if (!token) return res.status(401).json({ error: 'Missing token cookie' })

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // optionally fetch fresh user data from DB
    const result = await db.query('SELECT id, email, created_at FROM users WHERE id = $1', [payload.userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout (clear cookie)
app.post('/api/logout', (req, res) => {
  res.cookie('token', '', { httpOnly: true, maxAge: 0, path: '/' })
  res.json({ ok: true })
});


// Start server only after verifying DB connectivity.
(async function startServer() {
  try {
    await db.query('SELECT 1');
    console.log('Postgres connection: OK');
  } catch (err) {
    console.error('Postgres connection: FAILED');
    console.error(err);
    console.error('Backend will exit. Please check your DB settings in .env');
    process.exit(1);
    return;
  }

  app.listen(PORT, () => {
    console.log(`Auth backend running on http://localhost:${PORT}`);
  });
})();
