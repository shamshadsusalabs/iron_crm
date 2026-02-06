const express = require('express')
const router = express.Router()
const { verifyMerchAccessToken } = require('../middleware/merchAuthMiddleware')
const ctrl = require('../controllers/emailSettingsController')

// All routes protected: Merchandiser only
router.use(verifyMerchAccessToken)

router.get('/', ctrl.getMerchSettings)
router.put('/', ctrl.updateMerchSettings)
router.post('/test', ctrl.testMerchSettings)

module.exports = router
