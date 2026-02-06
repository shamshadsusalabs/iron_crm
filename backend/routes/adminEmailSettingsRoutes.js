const express = require('express')
const router = express.Router()
const { verifyAccessToken } = require('../middleware/authMiddleware')
const ctrl = require('../controllers/emailSettingsController')

// All routes protected: Admin only
router.use(verifyAccessToken)

router.get('/', ctrl.getAdminSettings)
router.put('/', ctrl.updateAdminSettings)
router.post('/test', ctrl.testAdminSettings)

module.exports = router
