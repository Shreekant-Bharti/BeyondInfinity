'use strict';

const { Router }      = require('express');
const AdminController = require('../controllers/adminController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = Router();

const adminOnly = [authenticateToken, authorizeRole(['ADMIN'])];

router.get('/users',          ...adminOnly, AdminController.listUsers);
router.post('/approve',       ...adminOnly, AdminController.approveUser);
router.delete('/users/:userId', ...adminOnly, AdminController.deleteUser);

module.exports = router;