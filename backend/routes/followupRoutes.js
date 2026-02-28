const express = require('express')
const router = express.Router()
const followupController = require('../controllers/followupController')
const { verifyAccessToken } = require('../middleware/authMiddleware')

// Apply authentication middleware to all routes
// router.use(authMiddleware)

// Campaign Routes
router.post('/campaigns', followupController.createCampaign)
router.get('/campaigns', followupController.getCampaigns)
router.get('/campaigns/:campaignId', followupController.getCampaignById)
router.put('/campaigns/:campaignId', followupController.updateCampaign)
router.delete('/campaigns/:campaignId', followupController.deleteCampaign)
router.post('/campaigns/:campaignId/start', followupController.startCampaign)
router.post('/campaigns/:campaignId/restart', followupController.restartCampaign)

// Contact Routes
router.get('/contacts/stats', followupController.getContactStats)
router.post('/contacts', followupController.createContact)
router.get('/contacts', followupController.getContacts)
router.put('/contacts/:contactId', followupController.updateContact)
router.delete('/contacts/:contactId', followupController.deleteContact)

// Contact List Routes
router.post('/contact-lists', followupController.createContactList)
router.get('/contact-lists', followupController.getContactLists)
router.put('/contact-lists/:listId', followupController.updateContactList)
router.delete('/contact-lists/:listId', followupController.deleteContactList)

// Template Routes
router.post('/templates', followupController.createTemplate)
router.get('/templates', followupController.getTemplates)
// Admin: list pending templates (place before /templates/:templateId)
router.get('/templates/pending', verifyAccessToken, followupController.listPendingTemplatesForAdmin)
router.put('/templates/:templateId', followupController.updateTemplate)
router.delete('/templates/:templateId', followupController.deleteTemplate)
// Admin: approve template
router.patch('/templates/:templateId/approve', verifyAccessToken, followupController.approveTemplate)

// Follow-up Routes
router.post('/followups', followupController.createFollowup)
router.get('/followups', followupController.getFollowups)
router.put('/followups/:followupId', followupController.updateFollowup)
router.delete('/followups/:followupId', followupController.deleteFollowup)

// Analytics Routes
router.get('/stats/dashboard', followupController.getDashboardStats)
router.get('/campaigns/:campaignId/stats', followupController.getCampaignStats)

// ENHANCED: Sequence management endpoints
router.get('/campaigns/:campaignId/sequence-status', verifyAccessToken, followupController.getSequenceStatus)
router.post('/sequence/trigger-completion', verifyAccessToken, followupController.triggerSequenceCompletion)

// Bulk Operations
router.post('/contacts/bulk', followupController.bulkCreateContacts)
router.post('/contact-lists/:listId/contacts', followupController.bulkAddContactsToList)
router.delete('/contact-lists/:listId/contacts', followupController.bulkRemoveContactsFromList)

// Admin Routes (for processing scheduled followups)
router.post('/admin/process-followups', followupController.processFollowups)

module.exports = router 