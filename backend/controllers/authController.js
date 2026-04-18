'use strict';

const jwt       = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const logger    = require('../utils/logger');

const JWT_SECRET     = process.env.JWT_SECRET     || 'fallback_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

const AuthController = {

  async register(req, res) {
    const { name, email, password, role, regNumber, branch, batch } = req.body;
    const idCardUrl = req.file ? req.file.filename : null;

    if (!name || !email || !password || !regNumber || !branch || !batch || !idCardUrl) {
      return res.status(400).json({ success: false, error: 'All fields including ID card are required.', code: 400 });
    }

    const allowedRoles = ['WARDEN', 'STUDENT'];
    const assignedRole = allowedRoles.includes(String(role).toUpperCase())
      ? String(role).toUpperCase()
      : 'STUDENT';

    try {
      const existing = await UserModel.findOne({ email: email.toLowerCase().trim() });
      if (existing) {
        return res.status(409).json({ success: false, error: 'Email already registered.', code: 409 });
      }

      const user = await UserModel.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        role:   assignedRole,
        regNumber: regNumber.trim(),
        branch: branch.trim(),
        batch: batch.trim(),
        idCardUrl: idCardUrl,
        status: 'PENDING',
      });

      logger.info(`REGISTER — ${user.email} (${user.role}) registered. Awaiting admin approval.`);

      return res.status(201).json({
        success: true,
        message: 'Registration successful. Awaiting admin approval before you can login.',
        data:    user.toSafeObject(),
      });
    } catch (err) {
      logger.error('REGISTER — failed', err);
      return res.status(500).json({ success: false, error: 'Registration failed. Try again.', code: 500 });
    }
  },

  async login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email and password are required.', code: 400 });
    }

    try {
      const user = await UserModel.findOne({ email: email.toLowerCase().trim() });

      if (!user) {
        logger.warn(`LOGIN FAILED — no account for ${email}`);
        return res.status(401).json({ success: false, error: 'Invalid email or password.', code: 401 });
      }

      const valid = await user.comparePassword(password);
      if (!valid) {
        logger.warn(`LOGIN FAILED — wrong password for ${email}`);
        return res.status(401).json({ success: false, error: 'Invalid email or password.', code: 401 });
      }

      if (user.status === 'PENDING') {
        logger.warn(`LOGIN BLOCKED — ${email} is PENDING approval`);
        return res.status(403).json({
          success: false,
          error:   'Your account is pending admin approval. Please wait.',
          code:    403,
        });
      }

      if (user.status === 'REJECTED') {
        logger.warn(`LOGIN BLOCKED — ${email} was REJECTED`);
        return res.status(403).json({
          success: false,
          error:   'Your account has been rejected. Contact admin.',
          code:    403,
        });
      }

      const token = generateToken(user);
      logger.info(`LOGIN OK — ${user.email} (${user.role})`);

      return res.status(200).json({
        success: true,
        message: `Welcome, ${user.name}!`,
        data: {
          token,
          user: user.toSafeObject(),
        },
      });
    } catch (err) {
      logger.error('LOGIN — failed', err);
      return res.status(500).json({ success: false, error: 'Login failed. Try again.', code: 500 });
    }
  },

  async me(req, res) {
    try {
      const user = await UserModel.findById(req.user.id).select('-password');
      if (!user) return res.status(404).json({ success: false, error: 'User not found.', code: 404 });
      return res.status(200).json({ success: true, message: 'Current user', data: user });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to fetch user.', code: 500 });
    }
  },
};

module.exports = AuthController;