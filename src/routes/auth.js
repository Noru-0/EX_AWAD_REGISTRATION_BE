const express = require('express');
const AuthController = require('../controllers/AuthController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const authController = new AuthController();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);

// Protected routes (require authentication)
router.get('/me', authMiddleware.verifyToken, authController.getProfile);
router.post('/logout', authMiddleware.verifyToken, authController.logout);
router.get('/verify', authMiddleware.verifyToken, authController.verifyToken);

module.exports = router;