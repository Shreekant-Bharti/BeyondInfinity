'use strict';

const UserModel = require('../models/userModel');
const logger    = require('../utils/logger');

const DEFAULT_ADMIN = {
  name:     'BIT Sindri Admin',
  email:    'admin@bitsindri.ac.in',
  password: 'admin123',
  role:     'ADMIN',
  status:   'APPROVED',
};

async function seedAdmin() {
  try {
    const existing = await UserModel.findOne({ email: DEFAULT_ADMIN.email });
    if (existing) {
      logger.info('Seed — Default admin already exists. Skipping.');
      return;
    }

    await UserModel.create(DEFAULT_ADMIN);
    logger.success(`Seed — Default ADMIN created: ${DEFAULT_ADMIN.email} / ${DEFAULT_ADMIN.password}`);
    logger.warn('Seed — CHANGE the default admin password in production!');
  } catch (err) {
    logger.error('Seed — Failed to create default admin', err);
  }
}

module.exports = { seedAdmin };
