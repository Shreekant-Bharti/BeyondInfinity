'use strict';

const HistoryModel = require('./historySchema');
const logger       = require('../utils/logger');

const DB_LIMIT = parseInt(process.env.DB_HISTORY_LIMIT || '10', 10);

const HistoryRepository = {

  async save(record) {
    try {
      await HistoryModel.create(record);

      const count = await HistoryModel.countDocuments({ tankId: record.tankId });

      if (count > DB_LIMIT) {
        const excess   = count - DB_LIMIT;
        const oldDocs  = await HistoryModel
          .find({ tankId: record.tankId })
          .sort({ savedAt: 1 })
          .limit(excess)
          .select('_id');

        const idsToDelete = oldDocs.map(d => d._id);
        await HistoryModel.deleteMany({ _id: { $in: idsToDelete } });

        logger.info(`DB pruned ${excess} old record(s) for ${record.tankId}`, { remaining: DB_LIMIT });
      }

      logger.info(`DB saved record for ${record.tankId}`, {
        level:      record.level,
        pumpStatus: record.pumpStatus,
        mode:       record.mode,
      });
    } catch (err) {
      logger.error(`DB save failed for ${record.tankId}`, err);
    }
  },

  async getLast10(tankId) {
    try {
      return await HistoryModel
        .find({ tankId })
        .sort({ savedAt: -1 })
        .limit(DB_LIMIT)
        .lean();
    } catch (err) {
      logger.error(`DB fetch failed for ${tankId}`, err);
      return [];
    }
  },

  async getAll() {
    try {
      return await HistoryModel
        .find()
        .sort({ savedAt: -1 })
        .limit(DB_LIMIT * 6)
        .lean();
    } catch (err) {
      logger.error('DB fetch-all failed', err);
      return [];
    }
  },

  async getCountPerTank() {
    try {
      return await HistoryModel.aggregate([
        { $group: { _id: '$tankId', count: { $sum: 1 } } },
        { $sort:  { _id: 1 } },
      ]);
    } catch (err) {
      logger.error('DB aggregate failed', err);
      return [];
    }
  },
};

module.exports = HistoryRepository;
