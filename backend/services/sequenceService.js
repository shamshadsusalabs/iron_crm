const mongoose = require("mongoose")
const Campaign = require("../models/follow-up/Campaign")
const Email = require("../models/follow-up/Email")
const Contact = require("../models/follow-up/Contact")
const Template = require("../models/follow-up/Template")
const CatalogItem = require("../models/catalog/CatalogItem")
const logger = require("../utils/logger")

/**
 * Dedicated Sequence Campaign Service
 * Handles all sequence-specific logic with proper duplicate prevention
 */

// Enhanced Sequence tracking model with completion and repeat control
const SequenceEmailSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: "Contact", required: true },
  stepNumber: { type: Number, required: true }, // Which step in sequence (0, 1, 2...)
  emailId: { type: mongoose.Schema.Types.ObjectId, ref: "Email" },
  status: { type: String, enum: ["pending", "sent", "failed", "completed"], default: "pending" },
  scheduledAt: Date,
  sentAt: Date,
  completedAt: Date,
  isInitialEmail: { type: Boolean, default: false },
  // Repeat tracking
  repeatCycle: { type: Number, default: 1 }, // Which repeat cycle (1, 2, 3...)
  isRepeatEmail: { type: Boolean, default: false },
  // Sequence completion tracking
  isSequenceComplete: { type: Boolean, default: false },
  sequenceCompletedAt: Date
}, { timestamps: true })

// BULLETPROOF: Enhanced indexes for duplicate prevention and performance
SequenceEmailSchema.index({ campaignId: 1, contactId: 1, stepNumber: 1, repeatCycle: 1 }, { unique: true })
SequenceEmailSchema.index({ campaignId: 1, status: 1 })
SequenceEmailSchema.index({ scheduledAt: 1, status: 1 })

// Additional safety index for Email model duplicates
const EmailDuplicatePreventionSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, required: true },
  stepNumber: { type: Number, required: true },
  emailId: { type: mongoose.Schema.Types.ObjectId, required: true }
}, { timestamps: true })

EmailDuplicatePreventionSchema.index({ campaignId: 1, contactId: 1, stepNumber: 1 }, { unique: true })

const SequenceEmail = mongoose.model("SequenceEmail", SequenceEmailSchema)
const EmailDuplicatePrevention = mongoose.model("EmailDuplicatePrevention", EmailDuplicatePreventionSchema)

// Sequence completion tracking and repeat management
async function checkSequenceCompletion(campaignId, contactId) {
  try {
    const campaign = await Campaign.findById(campaignId)
    if (!campaign || campaign.sendType !== 'sequence') return false

    const totalSteps = campaign.sequence?.steps?.length || campaign.sequence?.maxFollowups || 3
    const sentEmails = await SequenceEmail.countDocuments({
      campaignId,
      contactId,
      status: 'sent'
    })

    // Check if all steps completed
    const isComplete = sentEmails >= totalSteps
    
    if (isComplete) {
      // Mark sequence as complete
      await SequenceEmail.updateMany(
        { campaignId, contactId },
        { 
          isSequenceComplete: true,
          sequenceCompletedAt: new Date()
        }
      )
      
      logger.info(`✅ SEQUENCE COMPLETED: Campaign ${campaignId}, Contact ${contactId}, Steps: ${sentEmails}/${totalSteps}`)
      
      // Check if repeat is needed
      const repeatDays = campaign.sequence?.repeatDays || 0
      if (repeatDays > 0) {
        await scheduleSequenceRepeat(campaignId, contactId, repeatDays)
      }
    }
    
    return isComplete
  } catch (error) {
    logger.error('Error checking sequence completion:', error)
    return false
  }
}

// Schedule sequence repeat based on repeatDays
async function scheduleSequenceRepeat(campaignId, contactId, repeatDays) {
  try {
    const campaign = await Campaign.findById(campaignId)
    if (!campaign) return

    // Check current repeat cycle
    const lastRepeatCycle = await SequenceEmail.findOne(
      { campaignId, contactId },
      {},
      { sort: { repeatCycle: -1 } }
    )
    
    const nextRepeatCycle = (lastRepeatCycle?.repeatCycle || 1) + 1
    const nextRepeatStartDate = new Date(Date.now() + (repeatDays * 24 * 60 * 60 * 1000))
    
    logger.info(`🔄 SCHEDULING REPEAT: Campaign ${campaignId}, Contact ${contactId}, Cycle ${nextRepeatCycle}, Start: ${nextRepeatStartDate}`)
    
    // Create new sequence for repeat cycle
    const contact = await Contact.findById(contactId)
    if (!contact) return
    
    await createSequenceForContact(campaign, contact, nextRepeatCycle, nextRepeatStartDate)
    
  } catch (error) {
    logger.error('Error scheduling sequence repeat:', error)
  }
}

// Create sequence for a specific contact and repeat cycle
async function createSequenceForContact(campaign, contact, repeatCycle = 1, startDate = null) {
  try {
    const steps = campaign.sequence?.steps || []
    const maxFollowups = campaign.sequence?.maxFollowups || 3
    const totalSteps = steps.length > 0 ? steps.length : maxFollowups
    
    let currentScheduleTime = startDate || new Date()
    
    for (let stepIndex = 0; stepIndex < totalSteps; stepIndex++) {
      const step = steps[stepIndex] || {}
      const delayHours = step.delayHours || campaign.sequence?.followupDelays?.[stepIndex] || 24
      
      // Check for existing sequence email in this repeat cycle
      const existingSequenceEmail = await SequenceEmail.findOne({
        campaignId: campaign._id,
        contactId: contact._id,
        stepNumber: stepIndex,
        repeatCycle
      })
      
      if (existingSequenceEmail) {
        logger.info(`⚠️ DUPLICATE PREVENTED: Step ${stepIndex}, Cycle ${repeatCycle} already exists for contact ${contact.email}`)
        continue
      }
      
      // Calculate schedule time for this step
      if (stepIndex > 0) {
        currentScheduleTime = new Date(currentScheduleTime.getTime() + (delayHours * 60 * 60 * 1000))
      }
      
      // Create sequence tracking record
      const sequenceEmail = new SequenceEmail({
        campaignId: campaign._id,
        contactId: contact._id,
        stepNumber: stepIndex,
        repeatCycle,
        isRepeatEmail: repeatCycle > 1,
        status: 'pending',
        scheduledAt: currentScheduleTime,
        isInitialEmail: stepIndex === 0 && repeatCycle === 1
      })
      
      await sequenceEmail.save()
      
      // Create actual email record
      const emailData = {
        campaignId: campaign._id,
        contactId: contact._id,
        templateId: step.templateId || campaign.template,
        userId: campaign.userId,
        status: 'queued',
        scheduledAt: currentScheduleTime,
        isFollowup: stepIndex > 0 || repeatCycle > 1,
        followupNumber: stepIndex,
        followupSequence: stepIndex,
        isRepeat: repeatCycle > 1,
        repeatNumber: repeatCycle - 1
      }
      
      // Build email content
      if (step.contentType === 'catalog' && step.catalogItems?.length > 0) {
        console.log('🔍 [SEQUENCE SERVICE] Building catalog content for step:', {
          stepIndex,
          contentType: step.contentType,
          catalogItems: step.catalogItems,
          subject: step.subject,
          message: step.message
        })
        
        const catalogContent = await buildCatalogEmailContent(step.catalogItems, step.message)
        emailData.subject = step.subject
        emailData.htmlContent = catalogContent.html
        emailData.textContent = catalogContent.text
        
        console.log('🔍 [SEQUENCE SERVICE] Catalog content built:', {
          htmlLength: catalogContent.html?.length || 0,
          textLength: catalogContent.text?.length || 0,
          subject: emailData.subject
        })
      } else {
        const template = await Template.findById(step.templateId || campaign.template)
        if (template) {
          emailData.subject = template.subject
          emailData.htmlContent = template.htmlContent
          emailData.textContent = template.textContent
        }
      }
      
      const email = new Email(emailData)
      await email.save()
      
      // Link sequence email to actual email
      sequenceEmail.emailId = email._id
      await sequenceEmail.save()
      
      logger.info(`📧 SEQUENCE EMAIL CREATED: Step ${stepIndex}, Cycle ${repeatCycle}, Contact: ${contact.email}, Scheduled: ${currentScheduleTime}`)
    }
    
    logger.info(`✅ SEQUENCE CREATED: Campaign ${campaign._id}, Contact ${contact.email}, Cycle ${repeatCycle}, Steps: ${totalSteps}`)
    
  } catch (error) {
    logger.error('Error creating sequence for contact:', {
      error: error.message || error,
      stack: error.stack,
      contactEmail: contact?.email,
      campaignId: campaign?._id,
      repeatCycle
    })
    throw error
  }
}

/**
 * Create sequence campaign with BULLETPROOF duplicate prevention
 */
async function createSequenceCampaign(campaignId, userId) {
  try {
    // ENHANCED: Pre-check to prevent duplicate sequence creation for initial cycle
    const existingSequenceEmails = await SequenceEmail.countDocuments({ 
      campaignId, 
      repeatCycle: 1 
    })
    const existingEmails = await Email.countDocuments({ 
      campaignId, 
      status: { $in: ['queued', 'sent', 'delivered'] },
      $or: [
        { isRepeat: { $ne: true } },
        { isRepeat: { $exists: false } }
      ]
    })
    
    if (existingSequenceEmails > 0 || existingEmails > 0) {
      logger.info(`🚫 INITIAL SEQUENCE ALREADY EXISTS: Campaign ${campaignId} has ${existingSequenceEmails} sequence emails and ${existingEmails} regular emails`)
      return { success: true, message: 'Initial sequence already created', duplicatePrevented: true }
    }

    const campaign = await Campaign.findOne({ _id: campaignId, userId })
      .populate("template")
      .populate("contacts")
      .populate("contactLists")

    if (!campaign) {
      throw new Error("Campaign not found")
    }

    if (!campaign.sequence) {
      throw new Error("Sequence configuration not found")
    }

    // Get all unique contacts with enhanced deduplication
    let contacts = [...campaign.contacts]
    for (const list of campaign.contactLists) {
      const listContacts = await Contact.find({ _id: { $in: list.contacts } })
      contacts = [...contacts, ...listContacts]
    }

    // ENHANCED DEDUPLICATION: Use Map for O(1) lookup
    const contactMap = new Map()
    contacts.forEach(contact => {
      if (contact && contact._id && contact.email) {
        const key = contact._id.toString()
        if (!contactMap.has(key)) {
          contactMap.set(key, contact)
        }
      }
    })
    
    const uniqueContacts = Array.from(contactMap.values())

    logger.info('Sequence campaign setup starting', {
      campaignId: campaign._id?.toString(),
      userId: campaign.userId?.toString?.() || campaign.userId,
      totalContacts: contacts.length,
      uniqueContacts: uniqueContacts.length,
      sequence: campaign.sequence
    })

    // Calculate initial delay - use first step's delayHours if available
    const { initialDelay, steps } = campaign.sequence
    const firstStepDelay = steps && steps[0] && steps[0].delayHours !== undefined ? steps[0].delayHours : initialDelay
    const now = Date.now()
    const initialDelayMs = (Number(firstStepDelay) || 0) * 60 * 60 * 1000
    const initialScheduleTime = new Date(now + initialDelayMs)

    // Initialize results array
    const results = []

    // Process each unique contact for initial sequence (cycle 1)
    for (const contact of uniqueContacts) {
      try {
        await createSequenceForContact(campaign, contact, 1, initialScheduleTime)
        results.push({ contact: contact.email, status: 'created' })
      } catch (error) {
        logger.error(`Error creating sequence for contact ${contact.email}:`, {
          error: error.message || error,
          stack: error.stack,
          contactEmail: contact?.email,
          campaignId: campaignId
        })
        results.push({ contact: contact.email, status: 'failed', error: error.message || 'Unknown error' })
      }
    }

    // Update campaign status
    await Campaign.findByIdAndUpdate(campaignId, {
      status: 'sending',
      'stats.totalSent': results.filter(r => r.status === 'created').length
    })

    logger.info('Sequence campaign setup completed', {
      campaignId: campaignId,
      totalProcessed: results.length,
      successful: results.filter(r => r.status === 'created').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      failed: results.filter(r => r.status === 'failed').length
    })

    return { success: true, results }

  } catch (error) {
    logger.error("Error creating sequence campaign:", error)
    throw error
  }
}

/**
 * Build email data for sequence step
 */
async function buildSequenceEmailData(campaign, contact, stepNumber, scheduledAt, userId) {
  const explicitSteps = Array.isArray(campaign.sequence?.steps) ? campaign.sequence.steps : []
  
  let emailData = {
    campaignId: campaign._id,
    contactId: contact._id,
    userId: userId,
    status: "queued",
    scheduledAt: scheduledAt,
    isFollowup: stepNumber > 0,
    followupSequence: stepNumber
  }

  if (explicitSteps.length > stepNumber) {
    // Use explicit step configuration
    const step = explicitSteps[stepNumber]
    
    if (step.contentType === 'catalog' && step.catalogItems && step.catalogItems.length > 0) {
      // Catalog content
      try {
        const catalogItems = await CatalogItem.find({ _id: { $in: step.catalogItems } }).lean()
        if (catalogItems.length === 0) {
          throw new Error(`No catalog items found for step ${stepNumber}`)
        }
        emailData.subject = step.subject || 'Check out our products'
        emailData.htmlContent = await buildEmailHtmlWithCatalogItems(catalogItems, step.message)
        emailData.textContent = await buildEmailTextWithCatalogItems(catalogItems, step.message)
        emailData.templateId = null
      } catch (catalogError) {
        logger.error(`Error building catalog content for step ${stepNumber}:`, catalogError)
        throw new Error(`Failed to build catalog content: ${catalogError.message}`)
      }
    } else {
      // Template content
      const stepTemplate = step.templateId ? await Template.findById(step.templateId) : campaign.template
      if (stepTemplate) {
        emailData.templateId = stepTemplate._id
        emailData.subject = stepTemplate.subject
        emailData.htmlContent = stepTemplate.htmlContent
        emailData.textContent = stepTemplate.textContent
      }
    }
  } else {
    // Fallback to campaign template
    emailData.templateId = campaign.template?._id
    emailData.subject = campaign.subject || campaign.template?.subject
    emailData.htmlContent = campaign.template?.htmlContent
    emailData.textContent = campaign.template?.textContent
  }

  return emailData
}

/**
 * Schedule follow-up steps for a contact
 */
async function scheduleFollowupSteps(campaign, contact, initialEmail, userId) {
  const explicitSteps = Array.isArray(campaign.sequence?.steps) ? campaign.sequence.steps : []
  
  if (explicitSteps.length <= 1) {
    return // No follow-up steps defined
  }

  let currentTimeMs = initialEmail.scheduledAt.getTime()

  // Schedule remaining steps - supports unlimited steps (1, 5, 10, 100+ steps)
  logger.info(`Scheduling ${explicitSteps.length - 1} follow-up steps for contact ${contact.email}`)
  
  for (let i = 1; i < explicitSteps.length; i++) {
    const step = explicitSteps[i]
    const delayMs = (step.delayHours !== undefined && step.delayHours !== null ? Number(step.delayHours) : 24) * 60 * 60 * 1000
    currentTimeMs += delayMs
    const stepScheduleTime = new Date(currentTimeMs)

    try {
      // ENHANCED TRIPLE CHECK: Prevent duplicates at multiple levels
      
      // 1. Check SequenceEmail tracking
      const existingSequence = await SequenceEmail.findOne({
        campaignId: campaign._id,
        contactId: contact._id,
        stepNumber: i
      })

      // 2. Check Email model - check for exact step matches
      const existingEmail = await Email.findOne({
        campaignId: campaign._id,
        contactId: contact._id,
        followupSequence: i,
        status: { $in: ['queued', 'sent', 'delivered'] }
      })

      // 3. Check for any email with same followupNumber (additional safety)
      const existingFollowupNumber = await Email.findOne({
        campaignId: campaign._id,
        contactId: contact._id,
        followupNumber: i + 1,
        status: { $in: ['queued', 'sent', 'delivered'] }
      })

      if (existingSequence || existingEmail || existingFollowupNumber) {
        logger.info(`🚫 DUPLICATE PREVENTED: Step ${i} already exists for contact ${contact.email}`)
        continue
      }

      // Create sequence tracking record
      const sequenceRecord = new SequenceEmail({
        campaignId: campaign._id,
        contactId: contact._id,
        stepNumber: i,
        scheduledAt: stepScheduleTime,
        isInitialEmail: false,
        status: 'pending'
      })

      await sequenceRecord.save()

      // Create email record
      const emailData = await buildSequenceEmailData(campaign, contact, i, stepScheduleTime, userId)
      const email = new Email(emailData)
      await email.save()

      // Link email to sequence record
      sequenceRecord.emailId = email._id
      await sequenceRecord.save()

      logger.info(`📧 FOLLOWUP SCHEDULED: Step ${i}, Contact: ${contact.email}, Scheduled: ${stepScheduleTime}`)

    } catch (stepError) {
      logger.error(`Error scheduling step ${i} for contact ${contact.email}:`, stepError)
    }
  }
}

// Process sequence completion and repeat logic
async function processSequenceCompletion() {
  try {
    const now = new Date()
    
    // Find all sent emails that might complete sequences
    const recentlySentEmails = await Email.find({
      status: 'sent',
      sentAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      isFollowup: true
    }).populate('campaignId')
    
    const processedSequences = new Set()
    
    for (const email of recentlySentEmails) {
      const sequenceKey = `${email.campaignId._id}_${email.contactId}`
      
      if (processedSequences.has(sequenceKey)) continue
      processedSequences.add(sequenceKey)
      
      // Check if this contact's sequence is complete
      await checkSequenceCompletion(email.campaignId._id, email.contactId)
    }
    
    logger.info(`🔍 SEQUENCE COMPLETION CHECK: Processed ${processedSequences.size} unique sequences`)
    
  } catch (error) {
    logger.error('Error processing sequence completion:', error)
  }
}

// Enhanced sequence status monitoring
async function monitorSequenceStatus(campaignId) {
  try {
    const campaign = await Campaign.findById(campaignId)
    if (!campaign || campaign.sendType !== 'sequence') return
    
    const sequenceStats = await SequenceEmail.aggregate([
      { $match: { campaignId: mongoose.Types.ObjectId(campaignId) } },
      {
        $group: {
          _id: {
            contactId: '$contactId',
            repeatCycle: '$repeatCycle'
          },
          totalSteps: { $sum: 1 },
          sentSteps: {
            $sum: {
              $cond: [{ $eq: ['$status', 'sent'] }, 1, 0]
            }
          },
          completedSteps: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          isComplete: { $first: '$isSequenceComplete' }
        }
      }
    ])
    
    logger.info(`📊 SEQUENCE MONITORING: Campaign ${campaignId}`, {
      totalSequences: sequenceStats.length,
      completedSequences: sequenceStats.filter(s => s.isComplete).length
    })
    
    return sequenceStats
    
  } catch (error) {
    logger.error('Error monitoring sequence status:', error)
    return []
  }
}

/**
 * Get sequence status for a campaign
 */
async function getSequenceStatus(campaignId, userId) {
  try {
    const sequenceRecords = await SequenceEmail.find({ campaignId })
      .populate('contactId', 'email firstName lastName')
      .populate('emailId', 'status sentAt openedAt clickedAt')
      .sort({ contactId: 1, stepNumber: 1 })

    return sequenceRecords
  } catch (error) {
    logger.error('Error getting sequence status:', error)
    return []
  }
}

/**
 * Build HTML email content with catalog items
 */
async function buildEmailHtmlWithCatalogItems(catalogItems, customMessage = '') {
  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${customMessage ? `<div style="margin-bottom: 20px; line-height: 1.6;">${customMessage.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>').replace(/\r/g, '<br>')}</div>` : ''}
  `
  
  for (const item of catalogItems) {
    // Handle files
    const fileUrl = (item.files && item.files.length > 0 && item.files[0].url) ? item.files[0].url : ""
    const fileName = (item.files && item.files.length > 0 && item.files[0].originalFilename) ? item.files[0].originalFilename : "Download"
    
    html += `
      <div style="border: 1px solid #ddd; margin: 20px 0; padding: 15px; border-radius: 8px;">
        <h3>${item.title}</h3>
        ${item.description ? `<p>${item.description}</p>` : ''}
        ${item.price ? `<p style="font-weight: bold; color: #2c5aa0;">Price: ₹${item.price}</p>` : ''}
        ${item.images && item.images.length > 0 ? `<img src="${item.images[0].url}" alt="${item.title}" style="max-width: 200px; height: auto;">` : ''}
        ${fileUrl ? `<div style="margin-top: 10px;"><a href="${fileUrl}" target="_blank" style="display: inline-block; padding: 6px 12px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; font-size: 13px;">📎 ${fileName}</a></div>` : ''}
      </div>
    `
  }
  
  html += `</div>`
  return html
}

async function buildEmailTextWithCatalogItems(catalogItems, customMessage = "") {
  const lines = []
  
  if (customMessage) {
    lines.push(customMessage)
    lines.push("")
  }
  
  lines.push("Featured Products:")
  lines.push("")
  
  for (const item of catalogItems) {
    lines.push(`- ${item.title}`)
    if (item.description) lines.push(`  ${item.description}`)
    if (item.price) lines.push(`  Price: ₹${item.price}`)
    lines.push("")
  }
  
  return lines.join("\n")
}

/**
 * Build catalog email content (both HTML and text)
 */
async function buildCatalogEmailContent(catalogItemIds, customMessage = '') {
  console.log('🔍 [SEQUENCE SERVICE] buildCatalogEmailContent called with:', {
    catalogItemIds,
    customMessage,
    type: typeof catalogItemIds,
    isArray: Array.isArray(catalogItemIds)
  })
  
  // Fetch catalog items from database
  const CatalogItem = require('../models/catalog/CatalogItem')
  const catalogItems = await CatalogItem.find({ _id: { $in: catalogItemIds } }).lean()
  
  console.log('🔍 [SEQUENCE SERVICE] Fetched catalog items:', {
    count: catalogItems.length,
    items: catalogItems.map(item => ({ id: item._id, title: item.title }))
  })
  
  const html = await buildEmailHtmlWithCatalogItems(catalogItems, customMessage)
  const text = await buildEmailTextWithCatalogItems(catalogItems, customMessage)
  
  return {
    html,
    text
  }
}

module.exports = {
  createSequenceCampaign,
  buildCatalogEmailContent,
  checkSequenceCompletion,
  processSequenceCompletion,
  monitorSequenceStatus,
  scheduleSequenceRepeat,
  getSequenceStatus,
  SequenceEmail
}
