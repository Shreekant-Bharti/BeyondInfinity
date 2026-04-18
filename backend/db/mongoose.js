'use strict';

const mongoose = require('mongoose');
const logger   = require('../utils/logger');

const URI_TEMPLATE   = process.env.MONGO_URI      || '';
const MONGO_PASSWORD = process.env.MONGO_PASSWORD  || '';
const RESOLVED_URI   = URI_TEMPLATE.replace('<PASSWORD>', MONGO_PASSWORD);

if (!URI_TEMPLATE) {
  logger.error('MONGO_URI is not defined in .env — MongoDB will not connect.');
} else if (!MONGO_PASSWORD) {
  logger.error('MONGO_PASSWORD is not defined in .env — URI placeholder will not be resolved.');
}

mongoose.set('strictQuery', true);

async function connectDB() {
  if (!RESOLVED_URI || RESOLVED_URI.includes('<PASSWORD>')) {
    logger.error('MongoDB URI is invalid or MONGO_PASSWORD was not substituted correctly.');
    return null;
  }

  try {
    const conn = await mongoose.connect(RESOLVED_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    logger.success(`MongoDB Atlas connected → ${conn.connection.host}`);
    logger.success(`Database: ${conn.connection.name}`);
    return conn;
  } catch (err) {
    logger.error('MongoDB connection FAILED', err);
    return null;
  }
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected — attempting auto-reconnect…');
});
mongoose.connection.on('reconnected', () => {
  logger.success('MongoDB reconnected successfully.');
});
mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error', err);
});

module.exports = { connectDB, mongoose };
