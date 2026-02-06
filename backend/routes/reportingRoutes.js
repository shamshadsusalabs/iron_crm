const express = require('express');
const { verifyAccessToken } = require('../middleware/authMiddleware');
const { summary } = require('../controllers/reportingController');

const router = express.Router();

router.get('/summary', verifyAccessToken, summary);

module.exports = router;
