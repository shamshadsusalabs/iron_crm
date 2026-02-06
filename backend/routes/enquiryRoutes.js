const express = require('express');
const router = express.Router();
const { verifyAccessToken } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/enquiryController');

// Protect all enquiry routes
router.use(verifyAccessToken);

// List
router.get('/', ctrl.listEnquiries);
// Create
router.post('/', ctrl.createEnquiry);
// Update
router.put('/:id', ctrl.updateEnquiry);
// Delete
router.delete('/:id', ctrl.deleteEnquiry);

// Excel upload (multipart/form-data, field name: file)
router.post('/upload-excel', ctrl.excelUploadMiddleware, ctrl.uploadEnquiriesExcel);

module.exports = router;
