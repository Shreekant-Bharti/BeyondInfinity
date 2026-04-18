'use strict';

const UserModel = require('../models/userModel');
const logger    = require('../utils/logger');

const AdminController = {

  async listUsers(req, res) {
    try {
      const { status } = req.query;
      const filter = {};
      if (status) filter.status = String(status).toUpperCase();

      const users = await UserModel.find(filter).select('-password').sort({ createdAt: -1 });
      return res.status(200).json({
        success: true,
        message: `${users.length} user(s) found`,
        count:   users.length,
        data:    users,
      });
    } catch (err) {
      logger.error('ADMIN listUsers — failed', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch users.', code: 500 });
    }
  },

  async approveUser(req, res) {
    const { userId, action, reason } = req.body;

    if (!userId || !action) {
      return res.status(400).json({ success: false, error: 'userId and action are required.', code: 400 });
    }

    const act = String(action).toUpperCase();
    if (act !== 'APPROVE' && act !== 'REJECT') {
      return res.status(422).json({ success: false, error: 'action must be "APPROVE" or "REJECT".', code: 422 });
    }

    if (act === 'REJECT' && (!reason || !String(reason).trim())) {
      return res.status(400).json({ success: false, error: 'A rejection reason is required.', code: 400 });
    }

    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found.', code: 404 });
      }

      if (user.role === 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Cannot change status of another ADMIN.', code: 403 });
      }

      const prevStatus = user.status;
      user.status = act === 'APPROVE' ? 'APPROVED' : 'REJECTED';

      if (act === 'REJECT') {
        user.rejectionReason = String(reason).trim();
      } else {
        user.rejectionReason = '';
      }

      await user.save();

      logger.info(
        `ADMIN ACTION — ${req.user.name} (${req.user.role}) ${act}D user ${user.email} (was ${prevStatus})` +
        (act === 'REJECT' ? ` | Reason: ${user.rejectionReason}` : ''),
      );

      return res.status(200).json({
        success: true,
        message: `User ${user.email} has been ${act}D.`,
        data:    user.toSafeObject(),
      });
    } catch (err) {
      logger.error('ADMIN approveUser — failed', err);
      return res.status(500).json({ success: false, error: 'Action failed. Try again.', code: 500 });
    }
  },

  async deleteUser(req, res) {
    const { userId } = req.params;
    try {
      const user = await UserModel.findById(userId);
      if (!user) return res.status(404).json({ success: false, error: 'User not found.', code: 404 });
      if (user.role === 'ADMIN') return res.status(403).json({ success: false, error: 'Cannot delete an ADMIN.', code: 403 });

      await user.deleteOne();
      logger.info(`ADMIN ACTION — ${req.user.name} deleted user ${user.email}`);
      return res.status(200).json({ success: true, message: `User ${user.email} deleted.` });
    } catch (err) {
      logger.error('ADMIN deleteUser — failed', err);
      return res.status(500).json({ success: false, error: 'Delete failed.', code: 500 });
    }
  },
};

module.exports = AdminController;