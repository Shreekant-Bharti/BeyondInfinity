const mongoose = require('mongoose');

const dryRunHistorySchema = new mongoose.Schema({
  tankId: { type: String, required: true },
  title: { type: String, required: true },
  fault: { type: String, required: true },
  message: { type: String },

  deletedBy: { type: String, required: true },
  deletedRole: { type: String, required: true },

  repairDetails: { type: String },
  repairCost: { type: Number, default: 0 },
  billImage: { type: String },

  resolvedAt: { type: Date, default: Date.now },
  month: { type: Number },
  year: { type: Number }
});

module.exports = mongoose.model('DryRunHistory', dryRunHistorySchema);
