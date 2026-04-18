'use strict';

const { Router }     = require('express');
const TankController = require('../controllers/tankController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = Router();

const anyUser    = [authenticateToken, authorizeRole(['ADMIN', 'WARDEN', 'STUDENT'])];
const staffOnly  = [authenticateToken, authorizeRole(['ADMIN', 'WARDEN'])];
const adminOnly  = [authenticateToken, authorizeRole(['ADMIN'])];

router.get('/tank',        TankController.getTank);
router.post('/tank',       authenticateToken, TankController.postSensorData);
router.post('/pump',       ...staffOnly,  TankController.setPump);
router.post('/mode',       ...adminOnly,  TankController.setMode);
router.get('/history',     ...staffOnly,  TankController.getHistory);
router.get('/analytics',   ...anyUser,    TankController.getAnalytics);
router.get('/db/history',  ...staffOnly,  TankController.getDbHistory);

module.exports = router;