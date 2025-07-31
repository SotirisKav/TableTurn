/**
 * Basic Authentication Middleware for Development Security
 * Provides simple HTTP Basic Auth protection that can be easily toggled
 */

const basicAuth = (req, res, next) => {
  // Skip auth if disabled via environment variable
  if (process.env.BASIC_AUTH_ENABLED !== 'true') {
    return next();
  }

  // Get credentials from environment
  const validUsername = process.env.BASIC_AUTH_USERNAME || 'aichmi';
  const validPassword = process.env.BASIC_AUTH_PASSWORD || 'development';

  // Get the Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return requestAuth(res);
  }

  // Decode the credentials
  const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  // Validate credentials
  if (username === validUsername && password === validPassword) {
    return next();
  }

  return requestAuth(res);
};

const requestAuth = (res) => {
  res.set('WWW-Authenticate', 'Basic realm="AICHMI Development"');
  res.status(401).json({
    error: 'Authentication required',
    message: 'Please provide valid credentials to access this application'
  });
};

export default basicAuth;