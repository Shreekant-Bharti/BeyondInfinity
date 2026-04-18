'use strict';

const mongoose = require('mongoose');

const historySchema = new mongoose.Schema(
  {
    tankId: {
      type:     String,
      required: true,
      index:    true,
    },
    tankName: {
      type:    String,
      default: '',
    },
    level: {
      type:     Number,
      required: true,
      min:      0,
      max:      100,
    },
    pumpStatus: {
      type:     String,
      enum:     ['ON', 'OFF'],
      required: true,
    },
    mode: {
      type:     String,
      enum:     ['AUTO', 'MANUAL'],
      required: true,
    },
    source: {
      type:    String,
      enum:    ['HARDWARE', 'SIMULATED'],
      default: 'HARDWARE',
    },
  },
  {
    timestamps: { createdAt: 'savedAt', updatedAt: false },
  },
);

historySchema.index({ tankId: 1, savedAt: -1 });

const HistoryModel = mongoose.model('TankHistory', historySchema);

module.exports = HistoryModel;
