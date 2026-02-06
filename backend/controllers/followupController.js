const followupService = require('../services/followupService')
const sequenceService = require('../services/sequenceService')
const catalogService = require('../services/catalogService')
const Contact = require("../models/follow-up/Contact")
const logger = require("../utils/logger")

// Helper to extract auth from header/body/query for quick merch integration
function getAuth(req) {
  const adminHeaderId = req.headers['x-admin-id']
  const userHeaderId = req.headers['x-user-id']
  const bodyId = req.body?.adminId || req.body?.userId
  const queryId = req.query?.userId
  // IMPORTANT: Prefer explicit header role (impersonation) over middleware-injected req.role
  const explicitRole = req.headers['x-role'] || req.role || req.query?.role

  // Decide role and user precedence
  let role = explicitRole
  let userId = null

  if (role === 'merch') {
    // Impersonation or merch: prefer x-user-id
    userId = userHeaderId || bodyId || queryId || null
  } else if (role === 'admin') {
    // Admin-only
    userId = adminHeaderId || bodyId || queryId || null
  } else {
    // No explicit role: infer sensibly. If both present, prefer user header for scoping.
    userId = userHeaderId || adminHeaderId || bodyId || queryId || null
    role = adminHeaderId && !userHeaderId ? 'admin' : (userId ? 'merch' : null)
  }

  return { userId, role }
}

// List all pending templates for admin (created by merch or inactive)
async function listPendingTemplatesForAdmin(req, res) {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admins only' })
    }
    const Template = require('../models/follow-up/Template')
    const query = { isActive: false }
    // Optionally filter only merch-created
    // query.createdByRole = 'merch'
    const templates = await Template.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
        },
      },
      { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          createdByUser: {
            name: '$creator.name',
            email: '$creator.email',
          },
        },
      },
      { $project: { creator: 0 } },
    ])
    return res.json({ success: true, data: templates })
  } catch (error) {
    logger.error('Error listing pending templates:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch pending templates', error: error.message })
  }
}

// Campaign Controllers
async function createCampaign(req, res) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }

    // Validate sequence structure if present
    if (req.body.sendType === 'sequence' && req.body.sequence) {
      const { sequence } = req.body

      // Validate global repeat settings
      if (sequence.repeatDays && (sequence.repeatDays < 0 || sequence.repeatDays > 30)) {
        return res.status(400).json({
          success: false,
          message: 'Repeat days must be between 0 and 30'
        })
      }

      // Validate sequence steps
      if (sequence.steps && Array.isArray(sequence.steps)) {
        for (let i = 0; i < sequence.steps.length; i++) {
          const step = sequence.steps[i]

          // Validate content type
          if (step.contentType && !['template', 'catalog'].includes(step.contentType)) {
            return res.status(400).json({
              success: false,
              message: `Invalid content type for step ${i + 1}. Must be 'template' or 'catalog'`
            })
          }

          // Validate catalog steps have required fields
          if (step.contentType === 'catalog') {
            if (!step.catalogItems || !Array.isArray(step.catalogItems) || step.catalogItems.length === 0) {
              return res.status(400).json({
                success: false,
                message: `Step ${i + 1} with catalog content must have at least one catalog item`
              })
            }
            if (!step.subject || step.subject.trim() === '') {
              return res.status(400).json({
                success: false,
                message: `Step ${i + 1} with catalog content must have a subject`
              })
            }
          }

          // Validate template steps have templateId
          if (step.contentType === 'template' || !step.contentType) {
            if (!step.templateId) {
              return res.status(400).json({
                success: false,
                message: `Step ${i + 1} with template content must have a templateId`
              })
            }
          }

          // Validate delay hours
          if (step.delayHours === undefined || step.delayHours === null || step.delayHours < 0) {
            return res.status(400).json({
              success: false,
              message: `Step ${i + 1} must have valid delay hours (>= 0)`
            })
          }
        }
      }
    }

    const campaignData = {
      ...req.body,
      userId
    }

    const campaign = await followupService.createCampaign(campaignData)

    res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      data: campaign
    })
  } catch (error) {
    logger.error("Error creating campaign:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create campaign",
      error: error.message
    })
  }
}

async function getCampaigns(req, res) {
  try {
    const { userId, role } = getAuth(req)
    const { page = 1, limit = 10, search = "", status = "" } = req.query
    // Strict guard: if a specific x-user-id (or resolved userId) exists, always scope by user
    const headerUserId = req.headers['x-user-id']
    const effectiveUserId = headerUserId || userId

    const isUserScoped = !!effectiveUserId // when impersonating or merch

    const result = isUserScoped
      ? await followupService.getCampaigns(effectiveUserId, {
        page: parseInt(page),
        limit: parseInt(limit),
        search: search.toString(),
        status: status.toString()
      })
      : await followupService.getAllCampaigns({
        page: parseInt(page),
        limit: parseInt(limit),
        search: search.toString(),
        status: status.toString()
      })

    res.json({
      success: true,
      data: result.campaigns,
      pagination: result.pagination
    })
  } catch (error) {
    logger.error("Error fetching campaigns:", {
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({
      success: false,
      message: "Failed to fetch campaigns",
      error: error.message
    })
  }
}

async function getCampaignById(req, res) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }
    const { campaignId } = req.params

    const campaign = await followupService.getCampaignById(campaignId, userId)

    res.json({
      success: true,
      data: campaign
    })
  } catch (error) {
    logger.error("Error fetching campaign:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch campaign",
      error: error.message
    })
  }
}

async function updateCampaign(req, res) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }
    const { campaignId } = req.params
    const updateData = req.body

    // Validate sequence structure if being updated
    if (updateData.sendType === 'sequence' && updateData.sequence) {
      const { sequence } = updateData

      // Validate global repeat settings
      if (sequence.repeatDays && (sequence.repeatDays < 0 || sequence.repeatDays > 30)) {
        return res.status(400).json({
          success: false,
          message: 'Repeat days must be between 0 and 30'
        })
      }

      // Validate sequence steps
      if (sequence.steps && Array.isArray(sequence.steps)) {
        for (let i = 0; i < sequence.steps.length; i++) {
          const step = sequence.steps[i]

          // Validate content type
          if (step.contentType && !['template', 'catalog'].includes(step.contentType)) {
            return res.status(400).json({
              success: false,
              message: `Invalid content type for step ${i + 1}. Must be 'template' or 'catalog'`
            })
          }

          // Validate catalog steps have required fields
          if (step.contentType === 'catalog') {
            if (!step.catalogItems || !Array.isArray(step.catalogItems) || step.catalogItems.length === 0) {
              return res.status(400).json({
                success: false,
                message: `Step ${i + 1} with catalog content must have at least one catalog item`
              })
            }
            if (!step.subject || step.subject.trim() === '') {
              return res.status(400).json({
                success: false,
                message: `Step ${i + 1} with catalog content must have a subject`
              })
            }
          }

          // Validate template steps have templateId
          if (step.contentType === 'template' || !step.contentType) {
            if (!step.templateId) {
              return res.status(400).json({
                success: false,
                message: `Step ${i + 1} with template content must have a templateId`
              })
            }
          }

          // Validate delay hours
          if (step.delayHours === undefined || step.delayHours < 0) {
            return res.status(400).json({
              success: false,
              message: `Step ${i + 1} must have valid delay hours (>= 0)`
            })
          }
        }
      }
    }

    const campaign = await followupService.updateCampaign(campaignId, userId, updateData)

    res.json({
      success: true,
      message: "Campaign updated successfully",
      data: campaign
    })
  } catch (error) {
    logger.error("Error updating campaign:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update campaign",
      error: error.message
    })
  }
}

async function deleteCampaign(req, res) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }
    const { campaignId } = req.params

    const result = await followupService.deleteCampaign(campaignId, userId)

    res.json({
      success: true,
      message: result.message
    })
  } catch (error) {
    logger.error("Error deleting campaign:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete campaign",
      error: error.message
    })
  }
}

async function startCampaign(req, res) {
  try {
    const { userId } = getAuth(req)
    const { campaignId } = req.params

    logger.info(`Controller: Starting campaign ${campaignId} for user ${userId}`)

    if (!userId) {
      logger.error("Missing userId in request")
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      })
    }

    if (!campaignId) {
      logger.error("Missing campaignId in request")
      return res.status(400).json({
        success: false,
        message: "Campaign ID is required"
      })
    }

    const campaign = await followupService.manualStartCampaign(campaignId, userId)

    logger.info(`Campaign ${campaignId} manually started successfully with sendType: ${campaign.sendType}`)

    logger.info(`Campaign ${campaignId} started successfully`)

    let message = ""
    if (campaign.sendType === 'immediate') {
      message = "Campaign started and emails are being sent immediately"
    } else if (campaign.sendType === 'scheduled') {
      message = "Campaign scheduled successfully"
    } else if (campaign.sendType === 'sequence') {
      message = "Campaign sequence setup completed"
    }

    res.json({
      success: true,
      message: message,
      data: campaign
    })
  } catch (error) {
    logger.error("Error starting campaign:", {
      error: error.message,
      stack: error.stack,
      campaignId: req.params.campaignId,
      userId: req.headers['x-admin-id'] || req.body.adminId
    })
    res.status(500).json({
      success: false,
      message: "Failed to start campaign",
      error: error.message
    })
  }
}

// Contact Controllers
async function createContact(req, res) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }
    const contactData = {
      ...req.body,
      userId
    }

    const contact = await followupService.createContact(contactData)

    res.status(201).json({
      success: true,
      message: "Contact created successfully",
      data: contact
    })
  } catch (error) {
    logger.error("Error creating contact:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create contact",
      error: error.message
    })
  }
}

async function getContacts(req, res) {
  try {
    const { userId, role } = getAuth(req)
    const { page = 1, limit = 10, search = "", status = "", listId = "" } = req.query
    // Strict guard: if x-user-id (or resolved userId) exists, always scope by user
    const headerUserId = req.headers['x-user-id']
    const effectiveUserId = headerUserId || userId
    const isUserScoped = !!effectiveUserId

    const result = isUserScoped
      ? await followupService.getContacts(effectiveUserId, {
        page: parseInt(page),
        limit: parseInt(limit),
        search: search.toString(),
        status: status.toString(),
        listId: listId.toString()
      })
      : await followupService.getAllContacts({
        page: parseInt(page),
        limit: parseInt(limit),
        search: search.toString(),
        status: status.toString(),
        listId: listId.toString()
      })

    res.json({
      success: true,
      data: result.contacts,
      pagination: result.pagination
    })
  } catch (error) {
    logger.error("Error fetching contacts:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch contacts",
      error: error.message
    })
  }
}

async function updateContact(req, res) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }
    const { contactId } = req.params
    const updateData = req.body

    const contact = await followupService.updateContact(contactId, userId, updateData)

    res.json({
      success: true,
      message: "Contact updated successfully",
      data: contact
    })
  } catch (error) {
    logger.error("Error updating contact:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update contact",
      error: error.message
    })
  }
}

async function deleteContact(req, res) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }
    const { contactId } = req.params

    const result = await followupService.deleteContact(contactId, userId)

    res.json({
      success: true,
      message: result.message
    })
  } catch (error) {
    logger.error("Error deleting contact:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete contact",
      error: error.message
    })
  }
}

// Contact List Controllers
async function createContactList(req, res) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }
    const listData = {
      ...req.body,
      userId
    }

    const contactList = await followupService.createContactList(listData)

    res.status(201).json({
      success: true,
      message: "Contact list created successfully",
      data: contactList
    })
  } catch (error) {
    logger.error("Error creating contact list:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create contact list",
      error: error.message
    })
  }
}

async function getContactLists(req, res) {
  try {
    const { userId, role } = getAuth(req)
    const { page = 1, limit = 10, search = "" } = req.query
    // Strict guard: if x-user-id (or resolved userId) exists, always scope by user
    const headerUserId = req.headers['x-user-id']
    const effectiveUserId = headerUserId || userId
    const isUserScoped = !!effectiveUserId

    const result = isUserScoped
      ? await followupService.getContactLists(effectiveUserId, {
        page: parseInt(page),
        limit: parseInt(limit),
        search: search.toString()
      })
      : await followupService.getAllContactLists({
        page: parseInt(page),
        limit: parseInt(limit),
        search: search.toString()
      })

    res.json({
      success: true,
      data: result.contactLists,
      pagination: result.pagination
    })
  } catch (error) {
    logger.error("Error fetching contact lists:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact lists",
      error: error.message
    })
  }
}

async function updateContactList(req, res) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }
    const { listId } = req.params
    const updateData = req.body

    const contactList = await followupService.updateContactList(listId, userId, updateData)

    res.json({
      success: true,
      message: "Contact list updated successfully",
      data: contactList
    })
  } catch (error) {
    logger.error("Error updating contact list:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update contact list",
      error: error.message
    })
  }
}

async function deleteContactList(req, res) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }
    const { listId } = req.params

    const result = await followupService.deleteContactList(listId, userId)

    res.json({
      success: true,
      message: result.message
    })
  } catch (error) {
    logger.error("Error deleting contact list:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete contact list",
      error: error.message
    })
  }
}

// Template Controllers
async function createTemplate(req, res) {
  try {
    // Prefer auth middleware injected user, fallback to headers/body/query
    const { userId, role } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }
    const createdByRole = role || 'admin'
    const templateData = {
      ...req.body,
      userId, // backward compatibility
      createdBy: userId,
      createdByRole,
      // Change: merch-created templates are active by default (no approval required)
      isActive: req.body.isActive ?? true,
      approvedBy: createdByRole === 'admin' ? (userId || null) : null,
      approvedAt: createdByRole === 'admin' ? new Date() : null,
    }

    const template = await followupService.createTemplate(templateData)

    res.status(201).json({
      success: true,
      message: "Template created successfully",
      data: template
    })
  } catch (error) {
    logger.error("Error creating template:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create template",
      error: error.message
    })
  }
}

// Approve a template (admin only)
async function approveTemplate(req, res) {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admins only' })
    }
    const { templateId } = req.params
    const Template = require('../models/follow-up/Template')
    const tpl = await Template.findByIdAndUpdate(
      templateId,
      { isActive: true, approvedBy: req.userId, approvedAt: new Date() },
      { new: true }
    )
    if (!tpl) return res.status(404).json({ success: false, message: 'Template not found' })
    return res.json({ success: true, message: 'Template approved', data: tpl })
  } catch (error) {
    logger.error('Error approving template:', error)
    return res.status(500).json({ success: false, message: 'Failed to approve template', error: error.message })
  }
}

async function getTemplates(req, res) {
  try {
    const { userId, role } = getAuth(req)
    const { page = 1, limit = 10, search = "", type = "", isActive, approvedOnly } = req.query
    // Strict guard: if x-user-id (or resolved userId) exists, always scope by user
    const headerUserId = req.headers['x-user-id']
    const effectiveUserId = headerUserId || userId
    const isUserScoped = !!effectiveUserId

    const commonOptions = {
      page: parseInt(page),
      limit: parseInt(limit),
      search: search.toString(),
      type: type.toString(),
      isActive: typeof isActive !== 'undefined' ? (isActive === 'true' || isActive === true || isActive === '1') : undefined,
      approvedOnly: !!(approvedOnly === 'true' || approvedOnly === true || approvedOnly === '1'),
    }

    const result = isUserScoped
      ? await followupService.getTemplates(effectiveUserId, commonOptions)
      : await followupService.getAllTemplates(commonOptions)

    res.json({
      success: true,
      data: result.templates,
      pagination: result.pagination
    })
  } catch (error) {
    logger.error("Error fetching templates:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch templates",
      error: error.message
    })
  }
}

async function updateTemplate(req, res) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }
    const { templateId } = req.params
    const updateData = req.body

    const template = await followupService.updateTemplate(templateId, userId, updateData)

    res.json({
      success: true,
      message: "Template updated successfully",
      data: template
    })
  } catch (error) {
    logger.error("Error updating template:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update template",
      error: error.message
    })
  }
}

async function deleteTemplate(req, res) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }
    const { templateId } = req.params

    const result = await followupService.deleteTemplate(templateId, userId)

    res.json({
      success: true,
      message: result.message
    })
  } catch (error) {
    logger.error("Error deleting template:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete template",
      error: error.message
    })
  }
}

// Follow-up Controllers
async function createFollowup(req, res) {
  try {
    const { userId } = getAuth(req)
    const followupData = {
      ...req.body,
      userId
    }

    const followup = await followupService.createFollowup(followupData)

    res.status(201).json({
      success: true,
      message: "Followup created successfully",
      data: followup
    })
  } catch (error) {
    logger.error("Error creating followup:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create followup",
      error: error.message
    })
  }
}

async function getFollowups(req, res) {
  try {
    const { userId } = getAuth(req)
    const { page = 1, limit = 10, status = "", campaignId = "" } = req.query

    const result = await followupService.getFollowups(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status: status.toString(),
      campaignId: campaignId.toString()
    })

    res.json({
      success: true,
      data: result.followups,
      pagination: result.pagination
    })
  } catch (error) {
    logger.error("Error fetching followups:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch followups",
      error: error.message
    })
  }
}

async function updateFollowup(req, res) {
  try {
    const { userId } = getAuth(req)
    const { followupId } = req.params
    const updateData = req.body

    const followup = await followupService.updateFollowup(followupId, userId, updateData)

    res.json({
      success: true,
      message: "Followup updated successfully",
      data: followup
    })
  } catch (error) {
    logger.error("Error updating followup:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update followup",
      error: error.message
    })
  }
}

async function deleteFollowup(req, res) {
  try {
    const { userId } = getAuth(req)
    const { followupId } = req.params

    const result = await followupService.deleteFollowup(followupId, userId)

    res.json({
      success: true,
      message: result.message
    })
  } catch (error) {
    logger.error("Error deleting followup:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete followup",
      error: error.message
    })
  }
}

// Analytics Controllers
async function getCampaignStats(req, res) {
  try {
    const { userId } = getAuth(req)
    const { campaignId } = req.params

    const stats = await followupService.getCampaignStats(campaignId, userId)

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error("Error fetching campaign stats:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch campaign stats",
      error: error.message
    })
  }
}

// Bulk Operations
async function bulkCreateContacts(req, res) {
  try {
    const { userId } = getAuth(req)
    const { contacts } = req.body

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Contacts array is required"
      })
    }

    const createdContacts = []
    const errors = []

    for (const contactData of contacts) {
      try {
        const contact = await followupService.createContact({
          ...contactData,
          userId
        })
        createdContacts.push(contact)
      } catch (error) {
        errors.push({
          email: contactData.email,
          error: error.message
        })
      }
    }

    res.status(201).json({
      success: true,
      message: `Created ${createdContacts.length} contacts successfully`,
      data: {
        created: createdContacts,
        errors: errors
      }
    })
  } catch (error) {
    logger.error("Error bulk creating contacts:", error)
    res.status(500).json({
      success: false,
      message: "Failed to bulk create contacts",
      error: error.message
    })
  }
}

async function bulkAddContactsToList(req, res) {
  try {
    const { userId } = getAuth(req)
    const { listId } = req.params
    const { contactIds } = req.body

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Contact IDs array is required"
      })
    }

    // Add contacts to list
    await followupService.updateContactList(listId, userId, {
      $addToSet: { contacts: { $each: contactIds } }
    })

    // Update contacts with list ID
    await Contact.updateMany(
      { _id: { $in: contactIds }, userId },
      { $addToSet: { listIds: listId } }
    )

    res.json({
      success: true,
      message: "Contacts added to list successfully"
    })
  } catch (error) {
    logger.error("Error adding contacts to list:", error)
    res.status(500).json({
      success: false,
      message: "Failed to add contacts to list",
      error: error.message
    })
  }
}

async function bulkRemoveContactsFromList(req, res) {
  try {
    const { userId } = getAuth(req)
    const { listId } = req.params
    const { contactIds } = req.body

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Contact IDs array is required"
      })
    }

    // Remove contacts from list
    await followupService.updateContactList(listId, userId, {
      $pull: { contacts: { $in: contactIds } }
    })

    // Update contacts to remove list ID
    await Contact.updateMany(
      { _id: { $in: contactIds }, userId },
      { $pull: { listIds: listId } }
    )

    res.json({
      success: true,
      message: "Contacts removed from list successfully"
    })
  } catch (error) {
    logger.error("Error removing contacts from list:", error)
    res.status(500).json({
      success: false,
      message: "Failed to remove contacts from list",
      error: error.message
    })
  }
}

// Process Scheduled Followups (Admin endpoint)
async function processFollowups(req, res) {
  try {
    await followupService.processScheduledFollowups()

    res.json({
      success: true,
      message: "Scheduled followups processed successfully"
    })
  } catch (error) {
    logger.error("Error processing followups:", error)
    res.status(500).json({
      success: false,
      message: "Failed to process followups",
      error: error.message
    })
  }
}

// Get sequence status and completion info
const getSequenceStatus = async (req, res) => {
  try {
    const { campaignId } = req.params
    const userId = req.user.id

    const sequenceStatus = await sequenceService.getSequenceStatus(campaignId, userId)
    const monitoringData = await sequenceService.monitorSequenceStatus(campaignId)

    res.json({
      success: true,
      data: {
        sequences: sequenceStatus,
        monitoring: monitoringData
      }
    })
  } catch (error) {
    logger.error('Error getting sequence status:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get sequence status',
      error: error.message
    })
  }
}

// Manually trigger sequence completion check
const triggerSequenceCompletion = async (req, res) => {
  try {
    await sequenceService.processSequenceCompletion()

    res.json({
      success: true,
      message: 'Sequence completion check triggered successfully'
    })
  } catch (error) {
    logger.error('Error triggering sequence completion:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to trigger sequence completion',
      error: error.message
    })
  }
}

async function getContactStats(req, res) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' })
    }

    const stats = await followupService.getContactStats(userId)

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error("Error fetching contact stats:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact stats",
      error: error.message
    })
  }
}

module.exports = {
  // Campaign Controllers
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  getSequenceStatus,
  triggerSequenceCompletion,

  getContactStats,

  // Contact Controllers
  createContact,
  getContacts,
  updateContact,
  deleteContact,

  // Contact List Controllers
  createContactList,
  getContactLists,
  updateContactList,
  deleteContactList,

  // Template Controllers
  createTemplate,
  listPendingTemplatesForAdmin,
  approveTemplate,
  getTemplates,
  updateTemplate,
  deleteTemplate,

  // Follow-up Controllers
  createFollowup,
  getFollowups,
  updateFollowup,
  deleteFollowup,

  // Analytics Controllers
  getCampaignStats,

  // Bulk Operations
  bulkCreateContacts,
  bulkAddContactsToList,
  bulkRemoveContactsFromList,

  // Admin Operations
  processFollowups
} 