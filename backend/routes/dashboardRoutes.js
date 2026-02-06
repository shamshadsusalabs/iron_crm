const express = require('express');
const { verifyAccessToken } = require('../middleware/authMiddleware');
const { summary, timeseries, recent } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', verifyAccessToken, summary);
router.get('/timeseries', verifyAccessToken, timeseries);
router.get('/recent', verifyAccessToken, recent);

module.exports = router;
