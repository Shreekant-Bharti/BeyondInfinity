'use strict';

const fs             = require('fs');
const { Router }     = require('express');
const multer         = require('multer');
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });

const router = Router();

router.post('/register', upload.single('idCard'), AuthController.register);
router.post('/login',    AuthController.login);
router.get('/me',        authenticateToken, AuthController.me);

module.exports = router;