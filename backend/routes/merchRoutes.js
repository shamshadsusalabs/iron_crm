const express = require('express')
const multer = require('multer')
const { login, requestOTP, verifyOTP, refreshToken, getProfile, logout } = require('../controllers/merchController')
const leadCtrl = require('../controllers/merchLeadController')
const eventCtrl = require('../controllers/merchEvent.controller')
const upload = multer({ storage: multer.memoryStorage() })
const { verifyMerchAccessToken } = require('../middleware/merchAuthMiddleware')

const router = express.Router()
const merchDashboard = require('../controllers/merchDashboardController')

// Public - OTP based login flow
router.post('/request-otp', requestOTP)  // Step 1: Validate credentials, send OTP to admin
router.post('/verify-otp', verifyOTP)    // Step 2: Verify OTP and get tokens
router.post('/login', login)             // Legacy endpoint (now calls requestOTP)
router.post('/refresh-token', refreshToken)


// Protected
router.get('/profile', verifyMerchAccessToken, getProfile)
router.post('/logout', verifyMerchAccessToken, logout)

// Leads CRUD (Merchandiser only)
router.get('/leads', verifyMerchAccessToken, leadCtrl.listLeads)
router.post('/leads', verifyMerchAccessToken, leadCtrl.createLead)
router.get('/leads/:id', verifyMerchAccessToken, leadCtrl.getLeadById)
router.put('/leads/:id', verifyMerchAccessToken, leadCtrl.updateLead)
router.delete('/leads/:id', verifyMerchAccessToken, leadCtrl.deleteLead)

// Events (create + list)
router.get('/events', verifyMerchAccessToken, eventCtrl.listEvents)
router.post('/events', verifyMerchAccessToken, eventCtrl.createEvent)
router.get('/events/:id', verifyMerchAccessToken, eventCtrl.getEventById)
router.put('/events/:id', verifyMerchAccessToken, eventCtrl.updateEvent)
router.delete('/events/:id', verifyMerchAccessToken, eventCtrl.deleteEvent)
// Upload event attachment
router.post('/events/attachments', verifyMerchAccessToken, upload.single('file'), eventCtrl.uploadAttachment)

// Merch Dashboard
router.get('/dashboard/summary', verifyMerchAccessToken, merchDashboard.summary)
router.get('/dashboard/timeseries', verifyMerchAccessToken, merchDashboard.timeseries)

module.exports = router
