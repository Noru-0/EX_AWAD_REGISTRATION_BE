/**
 * Cookie utilities for secure token management
 */

const generateCookieOptions = () => {
  const isDev = process.env.NODE_ENV !== 'production';
  
  const options = {
    httpOnly: true, // Prevents XSS attacks
    secure: !isDev, // HTTPS only in production
    sameSite: isDev ? 'lax' : 'none', // Cross-origin support for production
    path: '/', // Available on all paths
  };

  // Optional: Set domain for production if needed
  const cookieDomain = process.env.COOKIE_DOMAIN;
  if (!isDev && cookieDomain) {
    options.domain = cookieDomain;
  }

  return options;
};

const parseCookies = (cookieHeader) => {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return {};
  }

  return cookieHeader
    .split(';')
    .map(c => c.trim())
    .filter(Boolean)
    .reduce((acc, cur) => {
      const [key, ...value] = cur.split('=');
      if (key && value.length > 0) {
        acc[key] = decodeURIComponent(value.join('='));
      }
      return acc;
    }, {});
};

const extractTokensFromCookies = (req) => {
  // Try to get from cookie-parser first (if available)
  if (req.cookies) {
    return {
      accessToken: req.cookies.accessToken,
      refreshToken: req.cookies.refreshToken
    };
  }

  // Fallback to manual parsing
  const cookies = parseCookies(req.headers.cookie);
  return {
    accessToken: cookies.accessToken,
    refreshToken: cookies.refreshToken
  };
};

module.exports = {
  generateCookieOptions,
  parseCookies,
  extractTokensFromCookies
};