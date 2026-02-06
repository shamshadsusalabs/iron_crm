// routes/emailRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const emailController = require('../controllers/emailController');
const anyAuth = require('../middleware/anyAuthMiddleware');

// Configure multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Protect all email routes to enforce per-user settings
router.use(anyAuth);

// Email routes
router.get('/all', emailController.allMails);
router.get('/sent', emailController.sentMails);
router.get('/received', emailController.receivedMails);
router.get('/spam', emailController.spamMails);

// Use multer middleware for routes that might have attachments
router.post('/send-email', upload.array('attachments'), emailController.sendEmail);
router.post('/reply-email', upload.array('attachments'), emailController.replyToEmail);

module.exports = router;