const express = require('express');
const { register, login, refreshToken, getProfile, logout, updateProfile, changePassword } = require('../controllers/adminController');
const { verifyAccessToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.get('/profile', verifyAccessToken, getProfile);
router.put('/profile', verifyAccessToken, updateProfile);
router.patch('/change-password', verifyAccessToken, changePassword);
router.post('/logout', verifyAccessToken, logout);

module.exports = router;
