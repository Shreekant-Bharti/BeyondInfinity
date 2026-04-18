const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.post('/dryrun/save', authenticateToken, authorizeRole(['ADMIN', 'WARDEN']), reportController.saveDryRunHistory);
router.get('/reports/dryrun', authenticateToken, authorizeRole(['ADMIN']), reportController.getReports);
router.get('/reports/download', authenticateToken, authorizeRole(['ADMIN']), reportController.downloadDryRunReport);

module.exports = router;