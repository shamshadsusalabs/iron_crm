const express = require('express');
const router = express.Router();
const { verifyAccessToken } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/customerController');

// All customer routes are protected
router.use(verifyAccessToken);

// List + search + pagination
router.get('/', ctrl.listCustomers);

// Get single
router.get('/:id', ctrl.getCustomer);

// Create
router.post('/', ctrl.createCustomer);

// Update
router.put('/:id', ctrl.updateCustomer);

// Delete
router.delete('/:id', ctrl.deleteCustomer);

// Excel upload (multipart/form-data, field name: file)
router.post('/upload-excel', ctrl.excelUploadMiddleware, ctrl.uploadCustomersExcel);

module.exports = router;
