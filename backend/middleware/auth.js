'use strict';

const jwt    = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET     = process.env.JWT_SECRET     || 'fallback_secret_change_me';
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || '';

function authenticateToken(req, res, next) {
  const deviceKey = req.headers['x-api-key'];
  if (deviceKey && deviceKey === DEVICE_API_KEY) {
    req.user = { id: 'esp32-device', role: 'DEVICE' };
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token      = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    logger.warn(`AUTH DENIED — No token on ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ success: false, error: 'Access denied. No token provided.', code: 401 });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn(`AUTH DENIED — Invalid token on ${req.method} ${req.originalUrl}`);
    return res.status(403).json({ success: false, error: 'Invalid or expired token.', code: 403 });
  }
}

function authorizeRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated.', code: 401 });
    }

    if (req.user.role === 'DEVICE') return next();

    if (!roles.includes(req.user.role)) {
      logger.warn(
        `ROLE DENIED — User ${req.user.id} (${req.user.role}) tried ${req.method} ${req.originalUrl}. Required: ${roles.join('|')}`,
      );
      return res.status(403).json({
        success: false,
        error:   `Access denied. Required role: ${roles.join(' or ')}.`,
        code:    403,
      });
    }

    next();
  };
}

module.exports = { authenticateToken, authorizeRole };