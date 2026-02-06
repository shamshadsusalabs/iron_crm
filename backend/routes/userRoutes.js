const express = require('express');
const multer = require('multer');
const { verifyAccessToken } = require('../middleware/authMiddleware');
const {
  listUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  toggleActive,
  grantLeadAccess,
  revokeLeadAccess,
  grantCustomerProfiling,
  revokeCustomerProfiling,
  grantCustomerEnquiry,
  revokeCustomerEnquiry,
  grantEmailAccess,
  revokeEmailAccess,
  grantFollowUpAccess,
  revokeFollowUpAccess,
} = require('../controllers/userController');

const router = express.Router();

// Multer memory storage to receive avatar file
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Semantic routes (preferred)
router.get('/list', verifyAccessToken, listUsers);
router.post('/create', verifyAccessToken, upload.single('avatar'), createUser);
router.get('/get/:id', verifyAccessToken, getUser);
router.put('/update/:id', verifyAccessToken, upload.single('avatar'), updateUser);
router.delete('/delete/:id', verifyAccessToken, deleteUser);
router.patch('/toggle-active/:id', verifyAccessToken, toggleActive);
// Grant email access (set isEmailAccess = true)
// Removed email access routes

// New granular permission routes
router.patch('/grant-lead/:id', verifyAccessToken, grantLeadAccess);
router.patch('/revoke-lead/:id', verifyAccessToken, revokeLeadAccess);
router.patch('/grant-customer-profiling/:id', verifyAccessToken, grantCustomerProfiling);
router.patch('/revoke-customer-profiling/:id', verifyAccessToken, revokeCustomerProfiling);
router.patch('/grant-customer-enquiry/:id', verifyAccessToken, grantCustomerEnquiry);
router.patch('/revoke-customer-enquiry/:id', verifyAccessToken, revokeCustomerEnquiry);
router.patch('/grant-email/:id', verifyAccessToken, grantEmailAccess);
router.patch('/revoke-email/:id', verifyAccessToken, revokeEmailAccess);
router.patch('/grant-followup/:id', verifyAccessToken, grantFollowUpAccess);
router.patch('/revoke-followup/:id', verifyAccessToken, revokeFollowUpAccess);

module.exports = router;
