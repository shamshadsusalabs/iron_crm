const Followup = require("../models/follow-up/Followup")
const Campaign = require("../models/follow-up/Campaign")
const Contact = require("../models/follow-up/Contact")
const ContactList = require("../models/follow-up/ContactList")
const Template = require("../models/follow-up/Template")
const Email = require("../models/follow-up/Email")
const EmailTracking = require("../models/follow-up/EmailTracking")
const Unsubscribe = require("../models/follow-up/Unsubscribe")
const emailService = require("./emailService")
const logger = require("../utils/logger")
const CatalogItem = require("../models/catalog/CatalogItem")
const Admin = require("../models/admin")
const User = require("../models/user")
const { decrypt } = require("../utils/crypto")
const envEmail = require("../config/emailConfig")
const { createEmailTracking, addEmailTracking } = require("../utils/emailTracker")

// Simple variable replacement for templates
function replaceVariables(str = "", contact = {}, fromAddress = "") {
  if (!str) return ""
  const name = contact.firstName || contact.name || (contact.email ? contact.email.split('@')[0] : "")
  const company = contact.company || ""
  const domain = (fromAddress.split('@')[1] || '').split('.')[0] || 'OurCompany'
  const senderCompany = domain.charAt(0).toUpperCase() + domain.slice(1)
  const senderName = senderCompany
  const clientUrl = process.env.CLIENT_URL || 'https://crmfrontend-dbc12.web.app'
  const unsubscribeLink = `${clientUrl}/unsubscribe?email=${encodeURIComponent(contact.email || '')}`
  return str
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{company\}\}/g, company)
    .replace(/\{\{senderName\}\}/g, senderName)
    .replace(/\{\{senderCompany\}\}/g, senderCompany)
    .replace(/\{\{unsubscribeLink\}\}/g, unsubscribeLink)
}

// Resolve effective email config for a given userId (admin or merchant)
async function resolveEmailConfigByUserId(userId) {
  // Defaults from env
  const base = {
    user: envEmail.user,
    password: envEmail.password,
    imapHost: envEmail.imapHost,
    imapPort: envEmail.imapPort,
    smtpHost: envEmail.smtpHost,
    smtpPort: envEmail.smtpPort,
    fromName: undefined,
  }

  if (!userId) return base

  let doc = await Admin.findById(userId).select('emailSettings')
  if (!doc) {
    doc = await User.findById(userId).select('emailSettings')
  }
  const s = doc?.emailSettings
  if (s && s.enabled !== false && s.user) {
    return {
      user: s.user || base.user,
      password: s.passwordEnc ? decrypt(s.passwordEnc) : base.password,
      imapHost: s.imapHost || base.imapHost,
      imapPort: s.imapPort || base.imapPort,
      smtpHost: s.smtpHost || base.smtpHost,
      smtpPort: s.smtpPort || base.smtpPort,
      fromName: s.fromName,
    }
  }

  return base
}

// Admin: list templates across all users (no userId filter)
async function getAllTemplates({ page = 1, limit = 10, search = "", type = "", isActive = undefined, approvedOnly = false }) {
  try {
    const query = {}
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ]
    }
    if (type) {
      query.type = type
    }
    if (typeof isActive === 'boolean') {
      query.isActive = isActive
    }
    if (approvedOnly) {
      query.approvedAt = { $ne: null }
    }

    const templates = await Template.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const total = await Template.countDocuments(query)

    return {
      templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    }
  } catch (error) {
    logger.error("Error fetching all templates:", error)
    throw error
  }
}

// Send queued Emails whose scheduledAt is due
async function processDueEmails() {
  try {
    const now = new Date()

    // ENHANCED: Add processing lock check to prevent concurrent processing
    const dueEmails = await Email.find({
      status: 'queued',
      scheduledAt: { $lte: now },
      $or: [
        { processingLock: { $exists: false } },
        { processingLock: { $lt: new Date(Date.now() - 2 * 60 * 1000) } } // 2 minute timeout
      ]
    }).populate('templateId contactId campaignId')

    logger.info(`Found ${dueEmails.length} due emails to process`)

    for (const email of dueEmails) {
      try {
        // Set processing lock immediately
        const lockResult = await Email.findOneAndUpdate(
          { _id: email._id, status: 'queued' },
          { processingLock: new Date(), status: 'sending' },
          { new: true }
        )

        if (!lockResult) {
          logger.info(`Email ${email._id} already being processed or status changed`)
          continue
        }

        const template = email.templateId
        const contact = email.contactId
        if (!contact) {
          email.status = 'failed'
          await email.save()
          continue
        }

        logger.info(`Processing due email: ${email._id} for contact: ${contact.email}`)

        let computedHtml, computedText

        if (template) {
          // Template-based email
          computedHtml = await buildEmailHtmlWithCatalog(template)
          computedText = await buildEmailTextWithCatalog(template)
        } else {
          // Catalog-based email (already has htmlContent and textContent)
          computedHtml = email.htmlContent
          computedText = email.textContent
        }
        // Resolve per-user email config using the email's userId
        const cfg = await resolveEmailConfigByUserId(email.userId || email.user)
        let finalHtml = replaceVariables(computedHtml, contact, cfg.user || '')
        let finalText = replaceVariables(computedText, contact, cfg.user || '')
        // Append customMessage if present
        if (email.customMessage) {
          const appendHtml = `<div style=\"margin-top:12px; white-space:pre-wrap\">${email.customMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
          finalHtml = (finalHtml || '') + appendHtml
          finalText = (finalText || '') + "\n\n" + email.customMessage
        }

        // Create tracking record first
        const trackingId = await createEmailTracking(
          email._id,
          email.campaignId?._id || email.campaignId,
          contact._id
        )

        // Add tracking to HTML content
        const trackedHtml = finalHtml ? addEmailTracking(finalHtml, trackingId) : undefined

        // update contents before sending
        email.htmlContent = trackedHtml || finalHtml
        email.textContent = finalText
        email.trackingPixelId = trackingId

        const result = await emailService.sendEmail({
          to: contact.email,
          subject: email.subject,
          text: finalText,
          html: trackedHtml || finalHtml || undefined,
        }, cfg)

        email.status = 'sent'
        email.sentAt = new Date()
        email.messageId = result.messageId
        await email.save()

        // Add 'sent' event to tracking after email is actually sent
        const tracking = await EmailTracking.findOne({ trackingPixelId: trackingId });
        if (tracking) {
          tracking.events.push({
            type: 'sent',
            timestamp: new Date()
          });
          await tracking.save();
        }

        // Update campaign stats
        if (email.campaignId) {
          await Campaign.findByIdAndUpdate(email.campaignId, {
            $inc: { 'stats.totalSent': 1 }
          })
        }

        // CRITICAL: Check if this is a sequence campaign and BLOCK old followup creation
        const campaign = await Campaign.findById(email.campaignId)
        if (campaign && campaign.sendType === 'sequence') {
          logger.info(`🚫 SEQUENCE EMAIL SENT: Blocking old followup creation for ${contact.email}`)
          // Do NOT call createFollowupSequence for sequence campaigns
        } else if (campaign && campaign.settings?.enableFollowups && campaign.sendType !== 'sequence') {
          // DISABLED: Old followup creation completely blocked to prevent duplicates
          logger.info(`🚫 BLOCKED: Old followup creation for non-sequence campaign: ${campaign._id}`)
          // await createFollowupSequence(campaign, contact, email, email.userId)
        }
      } catch (err) {
        logger.error('Error sending due email:', { emailId: email._id, error: err.message })
        // Update email status and clear processing lock
        await Email.findByIdAndUpdate(email._id, {
          status: 'sent',
          sentAt: new Date(),
          messageId: result.messageId,
          $unset: { processingLock: 1 }
        })

        // ENHANCED: Check sequence completion after email sent
        if (email.campaignId && email.isFollowup) {
          const sequenceService = require('./sequenceService')
          await sequenceService.checkSequenceCompletion(email.campaignId, email.contactId)
        }
      }
    }
  } catch (error) {
    logger.error('Error processing due emails:', error)
    throw error
  }
}

// Process Scheduled Campaigns (initial sends at scheduledAt)
async function processScheduledCampaigns() {
  try {
    const now = new Date()
    logger.info('Processing scheduled campaigns', { nowISO: now.toISOString() })

    // ENHANCED: Add lock mechanism to prevent concurrent processing
    const campaigns = await Campaign.find({
      status: 'scheduled',
      scheduledAt: { $lte: now },
      $or: [
        { processingLock: { $exists: false } },
        { processingLock: { $lt: new Date(Date.now() - 5 * 60 * 1000) } } // 5 minute timeout
      ]
    })
      .populate('template')
      .populate('contacts')
      .populate('contactLists')

    logger.info('Scheduled campaigns due', { count: campaigns.length })

    for (const campaign of campaigns) {
      try {
        // Set processing lock to prevent concurrent processing
        await Campaign.findByIdAndUpdate(campaign._id, {
          processingLock: new Date()
        })

        const contactListCounts = (campaign.contactLists || []).map((l) => (l.contacts || []).length)
        logger.info('Sending scheduled campaign', {
          campaignId: campaign._id?.toString(),
          userId: campaign.userId?.toString?.() || campaign.userId,
          name: campaign.name,
          scheduledAtISO: campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString() : null,
          directContacts: (campaign.contacts || []).length,
          contactLists: (campaign.contactLists || []).length,
          contactListCounts,
        })

        // Handle different send types with proper duplicate prevention
        let result
        if (campaign.sendType === 'sequence') {
          // Use sequence service for sequence campaigns
          const sequenceService = require('./sequenceService')
          result = await sequenceService.createSequenceCampaign(campaign._id, campaign.userId)
        } else {
          // Use immediate send flow for non-sequence campaigns
          result = await sendCampaignEmails(campaign._id, campaign.userId)
        }
        // Clear processing lock
        await Campaign.findByIdAndUpdate(campaign._id, {
          $unset: { processingLock: 1 }
        })

        logger.info('Scheduled campaign completed', {
          campaignId: campaign._id?.toString(),
          finalStatus: result?.status,
          sentAtISO: result?.sentAt ? new Date(result.sentAt).toISOString() : null,
        })
      } catch (err) {
        logger.error('Error sending scheduled campaign:', { campaignId: campaign._id, error: err.message })
      }
    }
  } catch (error) {
    logger.error('Error processing scheduled campaigns:', error)
    throw error
  }
}

// Render a simple, email-safe catalog block (table-based)
function renderCatalogHTML(items = [], layout = "grid2", showPrices = false) {
  if (!items.length) return ""
  const cols = layout === "grid3" ? 3 : layout === "list" ? 1 : 2
  const colWidth = Math.floor(100 / cols)
  const rows = []
  for (let i = 0; i < items.length; i += cols) {
    const slice = items.slice(i, i + cols)
    const tds = slice
      .map((it) => {
        const img = (it.images && it.images[0] && it.images[0].url) || ""
        const firstFile = (it.files && it.files[0]) || null
        const fileUrl = firstFile?.url || ""
        const fileName = firstFile?.originalFilename || "File"
        const fileType = firstFile?.mimeType || firstFile?.resourceType || ""
        const price = typeof it.price === "number" ? `₹${it.price.toFixed(2)}` : ""
        const title = it.title || "Item"
        const url = it.url || fileUrl || "#"
        const hasClickable = !!(url && url !== "#")
        const fileBlock = (!img && fileUrl)
          ? (`<div style="padding:12px;text-align:center;background:#f7f7f7;border-top:1px solid #eee;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333;margin-bottom:8px;">
                  📎 ${fileName}
                </div>
                <a href="${fileUrl}" target="_blank" style="display:inline-block;padding:8px 12px;background:#0b5ed7;color:#fff;text-decoration:none;border-radius:4px;">Open file</a>
              </div>`)
          : ""
        return (
          `<td width="${colWidth}%" valign="top" style="padding:8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;overflow:hidden;">
              <tr>
                <td style="text-align:center;background:#fafafa;">
                  ${img ? (hasClickable ? `<a href="${url}" target="_blank"><img src="${img}" alt="${title}" style="display:block;width:100%;max-width:260px;height:auto;border:0;"/></a>` : `<img src="${img}" alt="${title}" style="display:block;width:100%;max-width:260px;height:auto;border:0;"/>`) : ""}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 12px;">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;font-weight:600;line-height:1.3;">
                    ${hasClickable ? `<a href="${url}" target="_blank" style="color:#111;text-decoration:none;">${title}</a>` : `${title}`}
                  </div>
                  ${it.description ? `<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#555;margin-top:6px;\">${it.description}</div>` : ""}
                  ${showPrices && price ? `<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111;margin-top:8px;font-weight:700;\">${price}</div>` : ""}
                </td>
              </tr>
              ${fileBlock ? `<tr><td>${fileBlock}</td></tr>` : ""}
            </table>
          </td>`
        )
      })
      .join("")
    rows.push(`<tr>${tds}</tr>`)
  }
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
    ${rows.join("")}
  </table>`
}

// Fallback: wrap plain text into a simple HTML block for HTML emails
function wrapTextAsHtml(text = "") {
  const safe = (text || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const withBr = safe.replace(/\r?\n/g, "<br/>")
  return `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5;padding:20px;">${withBr}</div></body></html>`
}

// Build a plain-text version with catalog appended or placeholder-replaced
async function buildEmailTextWithCatalog(template) {
  const ids = template.selectedCatalogItemIds || []
  const placeholder = "{{CATALOG_BLOCK}}"
  if (!ids.length) return template.textContent || ""
  const items = await CatalogItem.find({ _id: { $in: ids } }).lean()
  const lines = []
  lines.push("")
  lines.push("Catalog:")
  lines.push("--------")
  for (const item of items) {
    lines.push(`• ${item.title}`)
    if (item.description) lines.push(`  ${item.description}`)
    if (item.price) lines.push(`  Price: ₹${item.price}`)
    if (item.images?.length) {
      lines.push(`  Image: ${item.images[0].url}`)
    }
    lines.push("")
  }
  const catalogBlock = lines.join("\n")
  const baseText = template.textContent || ""
  if (baseText.includes(placeholder)) {
    return baseText.replace(placeholder, catalogBlock)
  }
  return baseText + "\n\n" + catalogBlock
}

// Build catalog-only email content for sequence steps
async function buildEmailTextWithCatalogItems(catalogItems, customMessage = "") {
  const lines = []
  if (customMessage) {
    lines.push(customMessage)
    lines.push("")
  }
  lines.push("")
  for (const item of catalogItems) {
    lines.push(`• ${item.title}`)
    if (item.description) lines.push(`  ${item.description}`)
    if (item.price) lines.push(`  Price: ₹${item.price}`)
    if (item.images?.length) {
      lines.push(`  Image: ${item.images[0].url}`)
    }
    lines.push("")
  }
  return lines.join("\n")
}

async function buildEmailHtmlWithCatalogItems(catalogItems, customMessage = "") {
  // Enhanced debug logging
  console.log('🔍 [CATALOG DEBUG] Starting buildEmailHtmlWithCatalogItems')
  console.log('🔍 [CATALOG DEBUG] catalogItems received:', JSON.stringify(catalogItems, null, 2))
  console.log('🔍 [CATALOG DEBUG] catalogItems length:', catalogItems?.length || 0)
  console.log('🔍 [CATALOG DEBUG] customMessage:', customMessage)

  logger.info(`Building catalog email HTML with ${catalogItems?.length || 0} items`)

  if (!catalogItems || catalogItems.length === 0) {
    console.log('❌ [CATALOG DEBUG] No catalog items found!')
    logger.warn('No catalog items found for email generation')
    return `
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        ${customMessage ? `<div style="margin-bottom: 20px; line-height: 1.6;">${customMessage.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>').replace(/\r/g, '<br>')}</div>` : ''}
        <p>No products available at the moment.</p>
      </body>
      </html>
    `
  }

  let html = `
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  `

  if (customMessage) {
    // Convert all types of line breaks to HTML breaks
    const formattedMessage = customMessage
      .replace(/\r\n/g, '<br>')  // Windows line breaks
      .replace(/\n/g, '<br>')    // Unix line breaks
      .replace(/\r/g, '<br>')    // Mac line breaks

    html += `<div style="margin-bottom: 20px; line-height: 1.6;">${formattedMessage}</div>`
  }

  html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0;">`

  for (let i = 0; i < catalogItems.length; i++) {
    const item = catalogItems[i]
    console.log(`🔍 [CATALOG DEBUG] Processing item ${i}:`, JSON.stringify(item, null, 2))

    // Enhanced null checks and default values
    const title = (item && item.title) ? String(item.title) : 'Untitled Product'
    const description = (item && item.description) ? String(item.description) : ''
    const price = (item && item.price) ? Number(item.price) : null
    const images = (item && Array.isArray(item.images)) ? item.images : []
    const files = (item && Array.isArray(item.files)) ? item.files : []

    console.log(`🔍 [CATALOG DEBUG] Processed values for item ${i}:`)
    console.log(`  - title: "${title}"`)
    console.log(`  - description: "${description}"`)
    console.log(`  - price: ${price}`)
    console.log(`  - images count: ${images.length}`)
    console.log(`  - files count: ${files.length}`)

    const fileUrl = (files.length > 0 && files[0] && files[0].url) ? String(files[0].url) : ""
    const fileName = (files.length > 0 && files[0] && files[0].originalFilename) ? String(files[0].originalFilename) : "Download"

    logger.info(`Processing catalog item: ${title}`)

    html += `
      <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; background: #f9f9f9;">
        ${images.length > 0 && images[0] && images[0].url ? `<img src="${images[0].url}" alt="${title}" style="width: 100%; max-width: 200px; height: auto; max-height: 150px; object-fit: cover; border-radius: 4px; margin-bottom: 10px;">` : ''}
        <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${title}</h3>
        ${description ? `<p style="margin: 0 0 10px 0; color: #666;">${description}</p>` : ''}
        ${price ? `<p style="margin: 0; font-weight: bold; color: #27ae60; font-size: 18px;">₹${price}</p>` : ''}
        ${fileUrl ? `<div style="margin-top: 10px;"><a href="${fileUrl}" target="_blank" style="display: inline-block; padding: 6px 12px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; font-size: 13px;">📎 ${fileName}</a></div>` : ''}
      </div>
    `
  }

  html += `</div></body></html>`
  console.log('✅ [CATALOG DEBUG] Final HTML generated, length:', html.length)
  return html
}

async function buildEmailHtmlWithCatalog(template) {
  const ids = template.selectedCatalogItemIds || []
  const placeholder = "{{CATALOG_BLOCK}}"
  // Respect text-only preference when htmlContent is absent
  if (template.forceTextOnly && !template.htmlContent) {
    return "" // send as text-only
  }
  const baseHtml = (template.htmlContent && template.htmlContent.trim())
    ? template.htmlContent
    : wrapTextAsHtml(template.textContent || "")
  if (!ids.length) return baseHtml
  const items = await CatalogItem.find({ _id: { $in: ids } }).lean()
  const block = renderCatalogHTML(items, template.catalogLayout || "grid2", !!template.showPrices)
  if (baseHtml && baseHtml.includes(placeholder)) {
    return baseHtml.replace(placeholder, block)
  }
  // Append if placeholder not present
  return baseHtml + block
}

// Campaign Management
async function createCampaign(campaignData) {
  try {
    const campaign = new Campaign(campaignData)
    await campaign.save()
    logger.info(`Campaign created: ${campaign._id}`)

    // Auto-handle different send types based on user intent
    if (campaign.sendType === 'immediate') {
      logger.info(`Auto-starting immediate campaign: ${campaign._id}`)
      try {
        await startCampaign(campaign._id, campaign.userId)
        logger.info(`Immediate campaign auto-started: ${campaign._id}`)
      } catch (error) {
        logger.error(`Failed to auto-start immediate campaign: ${campaign._id}`, error)
        // Don't throw error, let campaign be created in draft status
      }
    } else if (campaign.sendType === 'scheduled') {
      logger.info(`Auto-scheduling campaign: ${campaign._id}`)
      try {
        await updateCampaignStatus(campaign._id, 'scheduled')
        logger.info(`Campaign auto-scheduled: ${campaign._id}`)
      } catch (error) {
        logger.error(`Failed to auto-schedule campaign: ${campaign._id}`, error)
      }
    } else if (campaign.sendType === 'sequence') {
      logger.info(`Auto-setting up sequence campaign: ${campaign._id}`)
      try {
        // Check if sequence already started to prevent duplicates
        const existingEmails = await Email.countDocuments({
          campaignId: campaign._id,
          status: { $in: ['queued', 'sent', 'delivered'] }
        })

        if (existingEmails > 0) {
          logger.info(`🚫 SEQUENCE ALREADY STARTED: ${existingEmails} emails already exist for campaign ${campaign._id}`)
        } else {
          const sequenceService = require('./sequenceService')
          await sequenceService.createSequenceCampaign(campaign._id, campaign.userId)
          logger.info(`Sequence campaign auto-setup: ${campaign._id}`)
        }
      } catch (error) {
        logger.error(`Failed to auto-setup sequence campaign: ${campaign._id}`, error)
        // Don't use fallback to prevent double sequence creation
      }
    }

    return campaign
  } catch (error) {
    logger.error("Error creating campaign:", error)
    throw error
  }
}

// Admin: fetch all campaigns across users (no userId filter)
async function getAllCampaigns({ page = 1, limit = 10, search = "", status = "" }) {
  try {
    const query = {}

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } }
      ]
    }

    if (status) {
      query.status = status
    }

    const campaigns = await Campaign.find(query)
      .populate("contacts", "email firstName lastName")
      .populate("contactLists", "name totalContacts")
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const total = await Campaign.countDocuments(query)

    return {
      campaigns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    logger.error("Error fetching all campaigns:", error)
    throw error
  }
}

async function getCampaigns(userId, { page = 1, limit = 10, search = "", status = "" }) {
  try {
    const query = { userId }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } }
      ]
    }

    if (status) {
      query.status = status
    }

    const campaigns = await Campaign.find(query)
      .populate("contacts", "email firstName lastName")
      .populate("contactLists", "name totalContacts")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const total = await Campaign.countDocuments(query)

    return {
      campaigns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    logger.error("Error fetching campaigns:", {
      error: error.message,
      stack: error.stack
    })
    throw error
  }
}

async function getCampaignById(campaignId, userId) {
  try {
    const campaign = await Campaign.findOne({ _id: campaignId, userId })
      .populate("template", "name subject htmlContent")
      .populate("contacts", "email firstName lastName company")
      .populate("contactLists", "name totalContacts")
      .populate("userId", "name email")

    if (!campaign) {
      throw new Error("Campaign not found")
    }

    return campaign
  } catch (error) {
    logger.error("Error fetching campaign:", error)
    throw error
  }
}

async function updateCampaign(campaignId, userId, updateData) {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: campaignId, userId },
      updateData,
      { new: true, runValidators: true }
    )

    if (!campaign) {
      throw new Error("Campaign not found")
    }

    logger.info(`Campaign updated: ${campaignId}`)
    return campaign
  } catch (error) {
    logger.error("Error updating campaign:", error)
    throw error
  }
}

async function deleteCampaign(campaignId, userId) {
  try {
    const campaign = await Campaign.findOneAndDelete({ _id: campaignId, userId })

    if (!campaign) {
      throw new Error("Campaign not found")
    }

    // Delete related followups
    await Followup.deleteMany({ campaignId })

    // Delete related emails
    await Email.deleteMany({ campaignId })

    // Delete related email tracking
    await EmailTracking.deleteMany({ campaignId })

    logger.info(`Campaign deleted: ${campaignId}`)
    return { message: "Campaign deleted successfully" }
  } catch (error) {
    logger.error("Error deleting campaign:", error)
    throw error
  }
}

// Contact Management
async function createContact(contactData) {
  try {
    const contact = new Contact(contactData)
    await contact.save()

    // Add to lists and increment counts
    if (contact.listIds && contact.listIds.length > 0) {
      await ContactList.updateMany(
        { _id: { $in: contact.listIds } },
        {
          $addToSet: { contacts: contact._id },
          $inc: { totalContacts: 1 }
        }
      )
    }

    logger.info(`Contact created: ${contact._id}`)
    return contact
  } catch (error) {
    logger.error("Error creating contact:", error)
    throw error
  }
}

async function syncContactListCounts(userId = null) {
  try {
    const query = userId ? { userId } : {}
    const lists = await ContactList.find(query)
    let updatedCount = 0

    for (const list of lists) {
      // Find all contacts that have this listId
      const contacts = await Contact.find({ listIds: list._id }, '_id')
      const contactIds = contacts.map(c => c._id)

      await ContactList.findByIdAndUpdate(list._id, {
        contacts: contactIds,
        totalContacts: contactIds.length
      })
      updatedCount++
    }

    return { success: true, count: updatedCount }
  } catch (error) {
    logger.error("Error syncing contact list counts:", error)
    throw error
  }
}

async function getContacts(userId, { page = 1, limit = 10, search = "", status = "", listId = "" }) {
  try {
    const query = { userId }

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { interestedProducts: { $regex: search, $options: "i" } }
      ]
    }

    if (status) {
      query.status = status
    }

    if (listId) {
      query.listIds = listId
    }

    const contacts = await Contact.find(query)
      .populate("listIds", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const total = await Contact.countDocuments(query)

    return {
      contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    logger.error("Error fetching contacts:", error)
    throw error
  }
}

async function getAllContacts({ page = 1, limit = 10, search = "", status = "", listId = "" }) {
  try {
    const query = {}

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { interestedProducts: { $regex: search, $options: "i" } }
      ]
    }

    if (status) {
      query.status = status
    }

    if (listId) {
      query.listIds = listId
    }

    const contacts = await Contact.find(query)
      .populate("listIds", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const total = await Contact.countDocuments(query)

    return {
      contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    logger.error("Error fetching all contacts:", error)
    throw error
  }
}

async function updateContact(contactId, userId, updateData) {
  try {
    // Get old contact to compare lists
    const oldContact = await Contact.findOne({ _id: contactId, userId })

    const contact = await Contact.findOneAndUpdate(
      { _id: contactId, userId },
      updateData,
      { new: true, runValidators: true }
    )

    if (!contact) {
      throw new Error("Contact not found")
    }

    // Handle list updates if changed
    if (oldContact && updateData.listIds) {
      const oldLists = (oldContact.listIds || []).map(id => id.toString())
      const newLists = (contact.listIds || []).map(id => id.toString())

      const addedLists = newLists.filter(id => !oldLists.includes(id))
      const removedLists = oldLists.filter(id => !newLists.includes(id))

      if (addedLists.length > 0) {
        await ContactList.updateMany(
          { _id: { $in: addedLists } },
          {
            $addToSet: { contacts: contact._id },
            $inc: { totalContacts: 1 }
          }
        )
      }

      if (removedLists.length > 0) {
        await ContactList.updateMany(
          { _id: { $in: removedLists } },
          {
            $pull: { contacts: contact._id },
            $inc: { totalContacts: -1 }
          }
        )
      }
    }

    logger.info(`Contact updated: ${contactId}`)
    return contact
  } catch (error) {
    logger.error("Error updating contact:", error)
    throw error
  }
}

async function deleteContact(contactId, userId) {
  try {
    const contact = await Contact.findOneAndDelete({ _id: contactId, userId })

    if (!contact) {
      throw new Error("Contact not found")
    }

    // Remove from contact lists and decrement counts
    await ContactList.updateMany(
      { contacts: contactId },
      {
        $pull: { contacts: contactId },
        $inc: { totalContacts: -1 }
      }
    )

    logger.info(`Contact deleted: ${contactId}`)
    return { message: "Contact deleted successfully" }
  } catch (error) {
    logger.error("Error deleting contact:", error)
    throw error
  }
}

// Contact List Management
async function createContactList(listData) {
  try {
    const contactList = new ContactList(listData)
    await contactList.save()
    logger.info(`Contact list created: ${contactList._id}`)
    return contactList
  } catch (error) {
    logger.error("Error creating contact list:", error)
    throw error
  }
}

async function getContactLists(userId, { page = 1, limit = 10, search = "" }) {
  try {
    const query = { userId }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ]
    }

    const contactLists = await ContactList.find(query)
      .populate("contacts", "email firstName lastName company")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const total = await ContactList.countDocuments(query)

    return {
      contactLists,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    logger.error("Error fetching contact lists:", error)
    throw error
  }
}

// Admin: fetch all contact lists across users (no userId filter)
async function getAllContactLists({ page = 1, limit = 10, search = "" }) {
  try {
    const query = {}

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ]
    }

    const contactLists = await ContactList.find(query)
      .populate("contacts", "email firstName lastName company")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const total = await ContactList.countDocuments(query)

    return {
      contactLists,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    logger.error("Error fetching all contact lists:", error)
    throw error
  }
}

async function updateContactList(listId, userId, updateData) {
  try {
    const contactList = await ContactList.findOneAndUpdate(
      { _id: listId, userId },
      updateData,
      { new: true, runValidators: true }
    )

    if (!contactList) {
      throw new Error("Contact list not found")
    }

    logger.info(`Contact list updated: ${listId}`)
    return contactList
  } catch (error) {
    logger.error("Error updating contact list:", error)
    throw error
  }
}

async function deleteContactList(listId, userId) {
  try {
    const contactList = await ContactList.findOneAndDelete({ _id: listId, userId })

    if (!contactList) {
      throw new Error("Contact list not found")
    }

    // Remove list from contacts
    await Contact.updateMany(
      { listIds: listId },
      { $pull: { listIds: listId } }
    )

    logger.info(`Contact list deleted: ${listId}`)
    return { message: "Contact list deleted successfully" }
  } catch (error) {
    logger.error("Error deleting contact list:", error)
    throw error
  }
}

// Template Management
async function createTemplate(templateData) {
  try {
    const template = new Template(templateData)
    await template.save()
    logger.info(`Template created: ${template._id}`)
    return template
  } catch (error) {
    logger.error("Error creating template:", error)
    throw error
  }
}

async function getTemplates(userId, { page = 1, limit = 10, search = "", type = "", isActive = undefined, approvedOnly = false }) {
  try {
    const query = { userId }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } }
      ]
    }

    if (type) {
      query.type = type
    }
    if (typeof isActive === 'boolean') {
      query.isActive = isActive
    }
    if (approvedOnly) {
      query.approvedAt = { $ne: null }
    }

    const templates = await Template.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const total = await Template.countDocuments(query)

    return {
      templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    logger.error("Error fetching templates:", error)
    throw error
  }
}

async function updateTemplate(templateId, userId, updateData) {
  try {
    const template = await Template.findOneAndUpdate(
      { _id: templateId, userId },
      updateData,
      { new: true, runValidators: true }
    )

    if (!template) {
      throw new Error("Template not found")
    }

    logger.info(`Template updated: ${templateId}`)
    return template
  } catch (error) {
    logger.error("Error updating template:", error)
    throw error
  }
}

async function deleteTemplate(templateId, userId) {
  try {
    const template = await Template.findOneAndDelete({ _id: templateId, userId })

    if (!template) {
      throw new Error("Template not found")
    }

    logger.info(`Template deleted: ${templateId}`)
    return { message: "Template deleted successfully" }
  } catch (error) {
    logger.error("Error deleting template:", error)
    throw error
  }
}

// Follow-up Management
async function createFollowup(followupData) {
  try {
    const followup = new Followup(followupData)
    await followup.save()
    logger.info(`Followup created: ${followup._id}`)
    return followup
  } catch (error) {
    logger.error("Error creating followup:", error)
    throw error
  }
}

async function getFollowups(userId, { page = 1, limit = 10, status = "", campaignId = "" }) {
  try {
    const query = { userId }

    if (status) {
      query.status = status
    }

    if (campaignId) {
      query.campaignId = campaignId
    }

    const followups = await Followup.find(query)
      .populate("campaignId", "name subject")
      .populate("contactId", "email firstName lastName")
      .populate("templateId", "name subject")
      .populate("originalEmailId", "subject sentAt")
      .sort({ scheduledAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const total = await Followup.countDocuments(query)

    return {
      followups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    logger.error("Error fetching followups:", error)
    throw error
  }
}

async function updateFollowup(followupId, userId, updateData) {
  try {
    const followup = await Followup.findOneAndUpdate(
      { _id: followupId, userId },
      updateData,
      { new: true, runValidators: true }
    )

    if (!followup) {
      throw new Error("Followup not found")
    }

    logger.info(`Followup updated: ${followupId}`)
    return followup
  } catch (error) {
    logger.error("Error updating followup:", error)
    throw error
  }
}

async function deleteFollowup(followupId, userId) {
  try {
    const followup = await Followup.findOneAndDelete({ _id: followupId, userId })

    if (!followup) {
      throw new Error("Followup not found")
    }

    logger.info(`Followup deleted: ${followupId}`)
    return { message: "Followup deleted successfully" }
  } catch (error) {
    logger.error("Error deleting followup:", error)
    throw error
  }
}

// Campaign Execution
async function startCampaign(campaignId, userId) {
  try {
    logger.info(`Starting campaign: ${campaignId} for user: ${userId}`)

    const campaign = await Campaign.findOne({ _id: campaignId, userId })
      .populate("template")
      .populate("contacts")
      .populate("contactLists")

    if (!campaign) {
      const error = new Error("Campaign not found")
      logger.error("Campaign not found:", { campaignId, userId })
      throw error
    }

    logger.info(`Campaign found: ${campaign.name}, status: ${campaign.status}`)

    if (campaign.status !== "draft") {
      const error = new Error("Campaign can only be started from draft status")
      logger.error("Invalid campaign status:", { campaignId, status: campaign.status })
      throw error
    }

    if (!campaign.template) {
      const error = new Error("Campaign template not found")
      logger.error("Campaign template missing:", { campaignId })
      throw error
    }

    // Get all contacts from campaign
    let contacts = [...campaign.contacts]
    logger.info(`Direct contacts: ${contacts.length}`)

    // Add contacts from contact lists
    for (const list of campaign.contactLists) {
      try {
        const listContacts = await Contact.find({ _id: { $in: list.contacts } })
        contacts = [...contacts, ...listContacts]
        logger.info(`Contacts from list ${list.name}: ${listContacts.length}`)
      } catch (error) {
        logger.error(`Error fetching contacts from list ${list._id}:`, error)
      }
    }

    // Remove duplicates
    const uniqueContacts = contacts.filter((contact, index, self) =>
      index === self.findIndex(c => c._id.toString() === contact._id.toString())
    )

    logger.info(`Total unique contacts: ${uniqueContacts.length}`)

    if (uniqueContacts.length === 0) {
      const error = new Error("No contacts found for campaign")
      logger.error("No contacts found:", { campaignId, totalContacts: contacts.length })
      throw error
    }

    // Update campaign status
    campaign.status = "sending"
    campaign.stats.totalSent = uniqueContacts.length
    await campaign.save()
    logger.info(`Campaign status updated to sending: ${campaignId}`)

    // Resolve per-user SMTP config once for this campaign/user
    const cfg = await resolveEmailConfigByUserId(userId)

    // Send initial emails
    const emailPromises = uniqueContacts.map(async (contact) => {
      try {
        logger.info(`Processing contact: ${contact.email}`)

        // Check if email already exists for this campaign and contact (prevent duplicates)
        // Only check for step 0 (initial email) to allow follow-up steps
        console.log(`🔍 [SEQUENCE] Checking for existing email - Campaign: ${campaign._id}, Contact: ${contact._id}, Email: ${contact.email}`);
        const existingEmail = await Email.findOne({
          campaignId: campaign._id,
          contactId: contact._id,
          followupSequence: 0 // Only check initial email, allow follow-ups
        });

        if (existingEmail) {
          console.log(`⚠️ [SEQUENCE] DUPLICATE FOUND - Initial email already exists for contact ${contact.email}, Status: ${existingEmail.status}, Created: ${existingEmail.createdAt}`);
          logger.info(`Initial email already exists for contact ${contact.email}, skipping duplicate...`);
          return existingEmail;
        }

        console.log(`✅ [SEQUENCE] No duplicate found - Creating new email for ${contact.email}`);

        const computedHtml = await buildEmailHtmlWithCatalog(campaign.template)
        const computedText = await buildEmailTextWithCatalog(campaign.template)
        // Replace variables in final bodies using sender address from cfg
        let finalHtml = replaceVariables(computedHtml, contact, cfg.user || '')
        const finalText = replaceVariables(computedText, contact, cfg.user || '')

        const email = new Email({
          campaignId: campaign._id,
          contactId: contact._id,
          templateId: campaign.template._id,
          userId: userId,
          subject: campaign.subject || campaign.template.subject,
          htmlContent: finalHtml,
          textContent: finalText,
          status: "queued"
        })

        await email.save()
        console.log(`📧 [SEQUENCE] Email record created - ID: ${email._id?.toString()}, Contact: ${contact.email}, Status: ${email.status}`);
        logger.info(`Email record created: ${email._id}`)

        // Create tracking record first
        const trackingId = await createEmailTracking(
          email._id,
          campaign._id,
          contact._id
        )

        // Debug: Check what we have before tracking
        logger.info('Before adding tracking (sequence path):', {
          emailId: email._id?.toString(),
          contact: contact.email,
          trackingId,
          hasFinalHtml: !!finalHtml,
          finalHtmlLength: finalHtml ? finalHtml.length : 0,
          finalHtmlPreview: finalHtml ? finalHtml.substring(0, 100) + '...' : 'No HTML content'
        })

        // Add tracking pixel and click tracking to HTML content (same as immediate path)
        const trackedHtmlContent = addEmailTracking(finalHtml, trackingId)

        // Debug: Log the tracked HTML content
        logger.info('After adding tracking (sequence path):', {
          emailId: email._id?.toString(),
          contact: contact.email,
          trackingId,
          hasTrackingPixel: trackedHtmlContent.includes('/api/tracking/pixel/'),
          htmlLength: trackedHtmlContent.length,
          htmlPreview: trackedHtmlContent.substring(0, 200) + '...'
        })

        // Send email with tracking (same as immediate path)
        const emailResult = await emailService.sendEmail({
          to: contact.email,
          subject: email.subject,
          text: email.textContent,
          html: trackedHtmlContent
        }, cfg)

        // Update email status
        email.status = "sent"
        email.sentAt = new Date()
        email.messageId = emailResult.messageId
        await email.save()

        logger.info('SMTP send result (sequence path)', {
          emailId: email._id?.toString(),
          contact: contact.email,
          messageId: emailResult.messageId,
          accepted: emailResult.accepted,
          rejected: emailResult.rejected,
          response: emailResult.response,
        })

        // DISABLED: Old followup creation to prevent duplicates with new sequenceService
        // if (campaign.settings.enableFollowups) {
        //   await createFollowupSequence(campaign, contact, email, userId)
        // }

        logger.info(`Email sent successfully to: ${contact.email}`)
        return email
      } catch (error) {
        logger.error(`Error sending email to ${contact.email}:`, {
          error: error.message,
          stack: error.stack,
          contactId: contact._id,
          campaignId: campaign._id
        })
        return null
      }
    })

    await Promise.all(emailPromises)

    // Update campaign status
    campaign.status = "sent"
    campaign.sentAt = new Date()
    await campaign.save()

    logger.info(`Campaign started successfully: ${campaignId}`)
    return campaign
  } catch (error) {
    logger.error("Error starting campaign:", {
      error: error.message,
      stack: error.stack,
      campaignId,
      userId
    })
    throw error
  }
}

// Send campaign emails immediately
async function sendCampaignEmails(campaignId, userId) {
  try {
    const campaign = await Campaign.findOne({ _id: campaignId, userId })
      .populate("template")
      .populate("contacts")
      .populate("contactLists")

    if (!campaign) {
      throw new Error("Campaign not found")
    }

    // Get all contacts
    let contacts = [...campaign.contacts]
    for (const list of campaign.contactLists) {
      const listContacts = await Contact.find({ _id: { $in: list.contacts } })
      contacts = [...contacts, ...listContacts]
    }

    const uniqueContacts = contacts.filter((contact, index, self) =>
      index === self.findIndex(c => c._id.toString() === contact._id.toString())
    )

    logger.info('Immediate/scheduled send starting', {
      campaignId: campaign._id?.toString(),
      userId: campaign.userId?.toString?.() || campaign.userId,
      totalContacts: contacts.length,
      uniqueContacts: uniqueContacts.length,
    })

    // Send emails immediately
    const emailPromises = uniqueContacts.map(async (contact) => {
      try {
        // Enhanced duplicate check for immediate campaigns
        const existingEmail = await Email.findOne({
          campaignId: campaign._id,
          contactId: contact._id,
          status: { $in: ['queued', 'sent', 'delivered'] }
        });

        if (existingEmail) {
          logger.info(`Email already exists for contact ${contact.email}, skipping duplicate...`);
          return existingEmail;
        }

        const computedHtml2 = await buildEmailHtmlWithCatalog(campaign.template)
        const computedText2 = await buildEmailTextWithCatalog(campaign.template)
        const finalHtml2 = replaceVariables(computedHtml2, contact, emailService?.emailConfig?.user || '')
        const finalText2 = replaceVariables(computedText2, contact, emailService?.emailConfig?.user || '')
        const email = new Email({
          campaignId: campaign._id,
          contactId: contact._id,
          templateId: campaign.template._id,
          userId: userId,
          subject: campaign.subject || campaign.template.subject,
          htmlContent: finalHtml2,
          textContent: finalText2,
          status: "queued"
        })

        await email.save()
        logger.info('Email record created (immediate path)', { emailId: email._id?.toString(), contact: contact.email })

        // Create tracking record and add tracking to email content
        const trackingId = await createEmailTracking(
          email._id,
          campaign._id,
          contact._id
        )

        // Add tracking pixel and click tracking to HTML content
        const trackedHtmlContent = addEmailTracking(email.htmlContent, trackingId)

        // Debug: Log the tracked HTML content
        logger.info('Tracked HTML content preview:', {
          emailId: email._id?.toString(),
          contact: contact.email,
          trackingId,
          hasTrackingPixel: trackedHtmlContent.includes('/api/tracking/pixel/'),
          htmlLength: trackedHtmlContent.length,
          htmlPreview: trackedHtmlContent.substring(0, 200) + '...'
        })

        // Send email immediately with tracking
        const emailResult = await emailService.sendEmail({
          to: contact.email,
          subject: email.subject,
          text: email.textContent,
          html: trackedHtmlContent
        })

        email.status = "sent"
        email.sentAt = new Date()
        email.messageId = emailResult.messageId
        await email.save()

        logger.info('SMTP send result (immediate path)', {
          emailId: email._id?.toString(),
          contact: contact.email,
          messageId: emailResult.messageId,
          accepted: emailResult.accepted,
          rejected: emailResult.rejected,
          response: emailResult.response,
        })

        return email
      } catch (error) {
        logger.error(`Error sending email to ${contact.email}:`, {
          error: error.message,
          stack: error.stack,
          campaignId: campaign._id?.toString(),
          contactId: contact._id?.toString(),
        })
        return null
      }
    })

    await Promise.all(emailPromises)

    // Update campaign status
    campaign.status = "sent"
    campaign.sentAt = new Date()
    await campaign.save()

    logger.info(`Campaign emails sent immediately`, {
      campaignId: campaignId?.toString?.() || campaignId,
      finalStatus: campaign.status,
      sentAtISO: campaign.sentAt?.toISOString?.() || null,
    })
    return campaign
  } catch (error) {
    logger.error("Error sending campaign emails:", {
      error: error.message,
      stack: error.stack,
      campaignId,
      userId,
    })
    throw error
  }
}

// Update campaign status
async function updateCampaignStatus(campaignId, status) {
  try {
    const campaign = await Campaign.findByIdAndUpdate(
      campaignId,
      { status },
      { new: true }
    )
    logger.info(`Campaign status updated: ${campaignId} -> ${status}`)
    return campaign
  } catch (error) {
    logger.error("Error updating campaign status:", error)
    throw error
  }
}

// DEPRECATED: Setup sequence follow-ups (replaced by sequenceService)
async function setupSequenceFollowups(campaignId, userId) {
  logger.warn(`DEPRECATED: setupSequenceFollowups called for campaign ${campaignId} - this should use sequenceService instead`)
  return { success: false, message: 'This method is deprecated, use sequenceService instead' }
}

// OLD SEQUENCE CODE - COMPLETELY DISABLED TO PREVENT CONFLICTS
/*
async function setupSequenceFollowupsOLD(campaignId, userId) {
  try {
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

    // Get all contacts
    let contacts = [...campaign.contacts]
    for (const list of campaign.contactLists) {
      const listContacts = await Contact.find({ _id: { $in: list.contacts } })
      contacts = [...contacts, ...listContacts]
    }

    const uniqueContacts = contacts.filter((contact, index, self) => 
      index === self.findIndex(c => c._id.toString() === contact._id.toString())
    )

    // Calculate follow-up schedule
    const { initialDelay, followupDelays, maxFollowups } = campaign.sequence

    // Log campaign and sequence config for diagnostics
    logger.info('Sequence setup starting', {
      campaignId: campaign._id?.toString(),
      userId: campaign.userId?.toString?.() || campaign.userId,
      totalContacts: contacts.length,
      uniqueContacts: uniqueContacts.length,
      sequence: {
        initialDelay,
        followupDelays,
        maxFollowups,
      },
      nowISO: new Date().toISOString(),
    })

    // Schedule initial emails - use first step's delayHours if available
    const firstStepDelay = explicitSteps && explicitSteps[0] && explicitSteps[0].delayHours !== undefined ? explicitSteps[0].delayHours : initialDelay
    const now = Date.now()
    const initialDelayMs = (Number(firstStepDelay) || 0) * 60 * 60 * 1000
    const initialScheduleTime = new Date(now + initialDelayMs)

    // Create follow-up schedule for each contact
    const followupPromises = uniqueContacts.map(async (contact) => {
      try {
        // Check if initial email already exists for this campaign and contact (prevent duplicates)
        console.log(`🔍 [SEQUENCE_SETUP] Checking for existing email - Campaign: ${campaign._id}, Contact: ${contact._id}, Email: ${contact.email}`);
        const existingEmail = await Email.findOne({
          campaignId: campaign._id,
          contactId: contact._id,
          followupSequence: 0 // Only check initial email step
        });
        
        if (existingEmail) {
          console.log(`⚠️ [SEQUENCE_SETUP] DUPLICATE FOUND - Initial email already exists for contact ${contact.email}, Status: ${existingEmail.status}, Created: ${existingEmail.createdAt}`);
          logger.info(`Initial email already exists for contact ${contact.email}, skipping duplicate...`);
          return existingEmail;
        }
        
        console.log(`✅ [SEQUENCE_SETUP] No duplicate found - Creating new email for ${contact.email}`);

        // For sequence campaigns, handle initial step differently
        let initialEmailData = {
          campaignId: campaign._id,
          contactId: contact._id,
          userId: userId,
          status: "queued",
          scheduledAt: initialScheduleTime
        }

        // Check if we have sequence steps defined
        const explicitSteps = Array.isArray(campaign.sequence?.steps) ? campaign.sequence.steps : []
        
        if (explicitSteps.length > 0) {
          // Use first step for initial email
          const firstStep = explicitSteps[0]
          
          if (firstStep.contentType === 'catalog' && firstStep.catalogItems && firstStep.catalogItems.length > 0) {
            // Catalog content for first step
            console.log('🔍 [SEQUENCE DEBUG] Fetching catalog items for sequence:', JSON.stringify(firstStep.catalogItems))
            logger.info(`Fetching catalog items for sequence: ${JSON.stringify(firstStep.catalogItems)}`)
            
            const catalogItems = await CatalogItem.find({ _id: { $in: firstStep.catalogItems } }).lean()
            
            console.log('🔍 [SEQUENCE DEBUG] Raw catalog items from DB:', JSON.stringify(catalogItems, null, 2))
            console.log('🔍 [SEQUENCE DEBUG] Catalog items count:', catalogItems.length)
            
            if (catalogItems.length === 0) {
              console.log('❌ [SEQUENCE DEBUG] No catalog items found in database!')
            } else {
              catalogItems.forEach((item, index) => {
                console.log(`🔍 [SEQUENCE DEBUG] Item ${index}:`)
                console.log(`  - _id: ${item._id}`)
                console.log(`  - title: "${item.title}"`)
                console.log(`  - description: "${item.description}"`)
                console.log(`  - price: ${item.price}`)
                console.log(`  - images: ${JSON.stringify(item.images)}`)
                console.log(`  - files: ${JSON.stringify(item.files)}`)
              })
            }
            
            logger.info(`Found ${catalogItems.length} catalog items:`, catalogItems.map(item => ({ id: item._id, title: item.title })))
            
            initialEmailData.subject = firstStep.subject || 'Check out our products'
            initialEmailData.htmlContent = await buildEmailHtmlWithCatalogItems(catalogItems, firstStep.message)
            initialEmailData.textContent = await buildEmailTextWithCatalogItems(catalogItems, firstStep.message)
            initialEmailData.templateId = null
          } else {
            // Template content for first step
            const stepTemplate = firstStep.templateId ? await Template.findById(firstStep.templateId) : campaign.template
            if (stepTemplate) {
              initialEmailData.templateId = stepTemplate._id
              initialEmailData.subject = stepTemplate.subject
              initialEmailData.htmlContent = stepTemplate.htmlContent
              initialEmailData.textContent = stepTemplate.textContent
            }
          }
        } else {
          // Fallback to campaign template
          initialEmailData.templateId = campaign.template?._id
          initialEmailData.subject = campaign.subject || campaign.template?.subject
          initialEmailData.htmlContent = campaign.template?.htmlContent
          initialEmailData.textContent = campaign.template?.textContent
        }

        const initialEmail = new Email(initialEmailData)
        await initialEmail.save()
        logger.info('Initial email queued (sequence)', {
          emailId: initialEmail._id?.toString(),
          contact: contact.email,
          scheduledAtISO: initialEmail.scheduledAt?.toISOString?.() || null,
          scheduledAtIST: initialEmail.scheduledAt?.toLocaleString?.('en-IN', { timeZone: 'Asia/Kolkata' }) || null,
        })

        // Schedule follow-up emails
        let currentTimeMs = initialScheduleTime.getTime()
        // explicitSteps already declared above, reusing the same variable
        
        // Handle new sequence structure with steps (skip first step as it's already handled)
        if (explicitSteps.length > 1) {
          // Use per-step template/catalog selection for remaining steps
          for (let i = 1; i < explicitSteps.length; i++) {
            const step = explicitSteps[i] || {}
            const delayHours = step.delayHours !== undefined && step.delayHours !== null ? Number(step.delayHours) : 24
            const delayMs = delayHours * 60 * 60 * 1000
            currentTimeMs += delayMs
            const scheduledAt = new Date(currentTimeMs)

            let emailSubject, emailHtml, emailText, templateId = null

            // Handle different content types
            if (step.contentType === 'catalog' && step.catalogItems && step.catalogItems.length > 0) {
              // Catalog content
              logger.info(`Fetching catalog items for follow-up step ${i + 1}: ${JSON.stringify(step.catalogItems)}`)
              const catalogItems = await CatalogItem.find({ _id: { $in: step.catalogItems } }).lean()
              logger.info(`Found ${catalogItems.length} catalog items for step ${i + 1}:`, catalogItems.map(item => ({ id: item._id, title: item.title })))
              
              emailSubject = step.subject || `Follow-up ${i + 1}: Check out our products`
              emailHtml = await buildEmailHtmlWithCatalogItems(catalogItems, step.message)
              emailText = await buildEmailTextWithCatalogItems(catalogItems, step.message)
            } else {
              // Template content (default)
              const stepTemplate = step.templateId ? await Template.findById(step.templateId) : null
              if (!stepTemplate) {
                logger.warn('Step template not found, skipping follow-up step', {
                  campaignId: campaign._id?.toString(),
                  contact: contact.email,
                  stepIndex: i,
                  templateId: step.templateId || null,
                })
                continue
              }
              templateId = stepTemplate._id
              emailSubject = stepTemplate.subject || `Follow-up ${i + 1}: ${campaign.subject || stepTemplate.subject}`
              emailHtml = stepTemplate.htmlContent
              emailText = stepTemplate.textContent
            }

            const followupEmail = new Email({
              campaignId: campaign._id,
              contactId: contact._id,
              templateId: templateId,
              userId: userId,
              subject: emailSubject,
              htmlContent: emailHtml,
              textContent: emailText,
              // Persist per-step message to append at send time
              customMessage: step.message || undefined,
              status: "queued",
              scheduledAt: scheduledAt,
              followupNumber: i + 1,
              // Store step conditions for repeat logic
              stepConditions: step.conditions || {}
            })
            await followupEmail.save()

            // Add global repeat logic if configured
            const repeatDays = campaign.sequence?.repeatDays || 0
            // CORRECTED LOGIC: repeatDays = total days to keep sending
            // repeatDays: 1 = send for 1 day only (no repeats)
            // repeatDays: 2 = send for 2 days (1 repeat)
            // repeatDays: 3 = send for 3 days (2 repeats)
            if (repeatDays > 1) {
              // Check if repeats already exist to prevent duplicates
              const existingRepeats = await Email.countDocuments({
                campaignId: campaign._id,
                contactId: contact._id,
                followupNumber: i + 1,
                isRepeat: true
              })
              
              if (existingRepeats > 0) {
                logger.info(`🚫 REPEAT DUPLICATES PREVENTED: ${existingRepeats} repeats already exist for contact ${contact.email}, step ${i + 1}`)
              } else {
                // Schedule repeat emails for remaining days
                const repeatIntervalMs = 24 * 60 * 60 * 1000 // 24 hours interval
                const numberOfRepeats = Math.floor(repeatDays) - 1 // Subtract 1 because original email counts as day 1
              
              for (let r = 1; r <= numberOfRepeats; r++) {
                const repeatScheduledAt = new Date(scheduledAt.getTime() + (r * repeatIntervalMs))
                
                const repeatEmail = new Email({
                  campaignId: campaign._id,
                  contactId: contact._id,
                  templateId: templateId,
                  userId: userId,
                  subject: emailSubject,
                  htmlContent: emailHtml,
                  textContent: emailText,
                  customMessage: step.message || undefined,
                  status: "queued",
                  scheduledAt: repeatScheduledAt,
                  followupNumber: i + 1,
                  isRepeat: true,
                  repeatNumber: r,
                  stepConditions: step.conditions || {}
                })
                await repeatEmail.save()
                
                logger.info('Repeat email queued', {
                  emailId: repeatEmail._id?.toString(),
                  contact: contact.email,
                  followupNumber: i + 1,
                  repeatNumber: r,
                  scheduledAtISO: repeatEmail.scheduledAt?.toISOString?.() || null,
                })
              }
              }
            }
            logger.info('Follow-up email queued (sequence - explicit step)', {
              emailId: followupEmail._id?.toString(),
              contact: contact.email,
              followupNumber: i + 1,
              scheduledAtISO: followupEmail.scheduledAt?.toISOString?.() || null,
              scheduledAtIST: followupEmail.scheduledAt?.toLocaleString?.('en-IN', { timeZone: 'Asia/Kolkata' }) || null,
              delayHours,
              templateId: templateId?.toString() || null,
            })
          }
        } else {
          // Fall back to existing delays using the campaign's main template
          for (let i = 0; i < Math.min(maxFollowups, followupDelays.length); i++) {
            const delayHours = followupDelays[i] !== undefined && followupDelays[i] !== null ? Number(followupDelays[i]) : 24
            const delayMs = delayHours * 60 * 60 * 1000
            currentTimeMs += delayMs
            const scheduledAt = new Date(currentTimeMs)

            const followupEmail = new Email({
              campaignId: campaign._id,
              contactId: contact._id,
              templateId: campaign.template._id,
              userId: userId,
              subject: `Follow-up ${i + 1}: ${campaign.subject || campaign.template.subject}`,
              htmlContent: campaign.template.htmlContent,
              textContent: campaign.template.textContent,
              status: "queued",
              scheduledAt: scheduledAt,
              followupNumber: i + 1
            })
            await followupEmail.save()
            logger.info('Follow-up email queued (sequence)', {
              emailId: followupEmail._id?.toString(),
              contact: contact.email,
              followupNumber: i + 1,
              scheduledAtISO: followupEmail.scheduledAt?.toISOString?.() || null,
              scheduledAtIST: followupEmail.scheduledAt?.toLocaleString?.('en-IN', { timeZone: 'Asia/Kolkata' }) || null,
              delayHours,
            })
          }
        }

        return contact
      } catch (error) {
        logger.error(`Error setting up sequence for ${contact.email}:`, {
          error: error.message,
          stack: error.stack,
          campaignId: campaign._id?.toString(),
          userId: userId,
        })
        return null
      }
    })

    await Promise.all(followupPromises)

    // Update campaign status
    campaign.status = "scheduled"
    await campaign.save()

    logger.info(`Sequence follow-ups setup complete`, {
      campaignId: campaignId?.toString?.() || campaignId,
      totalContacts: uniqueContacts.length,
      status: campaign.status,
      scheduledStartISO: initialScheduleTime?.toISOString?.() || null,
      scheduledStartIST: initialScheduleTime?.toLocaleString?.('en-IN', { timeZone: 'Asia/Kolkata' }) || null,
    })
    return campaign
  } catch (error) {
    logger.error("Error setting up sequence follow-ups:", {
      error: error.message,
      stack: error.stack,
      campaignId,
      userId,
    })
    throw error
  }
}
*/

// COMPLETELY DISABLED: Follow-up Sequence Creation (CAUSES DUPLICATES)
async function createFollowupSequence(campaign, contact, originalEmail, userId) {
  logger.warn(`🚫 BLOCKED: createFollowupSequence called - this creates duplicates! Use sequenceService instead`)
  return { success: false, message: 'This function is disabled to prevent duplicates' }
}

// Export all functions
module.exports = {
  // Campaign Management
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  startCampaign,

  // Contact Management
  createContact,
  getContacts,
  getAllContacts,
  updateContact,
  deleteContact,

  // Contact List Management
  createContactList,
  getContactLists,
  getAllContactLists,
  updateContactList,
  deleteContactList,

  // Template Management
  createTemplate,
  getTemplates,
  getAllTemplates,
  updateTemplate,
  deleteTemplate,

  // Follow-up Management
  createFollowup,
  getFollowups,
  updateFollowup,
  deleteFollowup,

  // Campaign Execution
  processScheduledFollowups,
  processScheduledCampaigns,
  processDueEmails,
  sendCampaignEmails,
  updateCampaignStatus,
  setupSequenceFollowups,
  manualStartCampaign,

  // Analytics
  getCampaignStats
}

// OLD CODE DISABLED TO PREVENT DUPLICATES - REMOVED TO FIX SYNTAX ERROR

// Process Scheduled Followups
async function processScheduledFollowups() {
  try {
    const now = new Date()
    const scheduledFollowups = await Followup.find({
      status: "scheduled",
      scheduledAt: { $lte: now }
    }).populate("campaignId contactId templateId originalEmailId")

    for (const followup of scheduledFollowups) {
      try {
        // Check conditions
        const shouldSend = await checkFollowupConditions(followup)

        if (!shouldSend) {
          followup.status = "cancelled"
          await followup.save()
          continue
        }

        // Build HTML/TEXT with catalog and variables
        const computedHtml = await buildEmailHtmlWithCatalog(followup.templateId)
        const computedText = await buildEmailTextWithCatalog(followup.templateId)
        let finalHtml = replaceVariables(computedHtml, followup.contactId, emailService?.emailConfig?.user || '')
        let finalText = replaceVariables(computedText, followup.contactId, emailService?.emailConfig?.user || '')
        // Append per-followup message if present
        if (followup.message) {
          const appendHtml = `<div style=\"margin-top:12px; white-space:pre-wrap\">${followup.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
          finalHtml = (finalHtml || '') + appendHtml
          finalText = (finalText || '') + "\n\n" + followup.message
        }

        // Send followup email
        const email = new Email({
          campaignId: followup.campaignId._id,
          contactId: followup.contactId._id,
          templateId: followup.templateId._id,
          userId: followup.userId,
          subject: followup.templateId.subject,
          htmlContent: finalHtml,
          textContent: finalText,
          status: "queued",
          isFollowup: true,
          followupSequence: followup.sequence,
          parentEmailId: followup.originalEmailId._id
        })

        await email.save()

        // Send email
        const emailResult = await emailService.sendEmail({
          to: followup.contactId.email,
          subject: email.subject,
          text: email.textContent,
          html: email.htmlContent
        })

        // Update email status
        email.status = "sent"
        email.sentAt = new Date()
        email.messageId = emailResult.messageId
        await email.save()

        // Update followup status
        followup.status = "sent"
        followup.sentAt = new Date()
        await followup.save()

        // Create email tracking
        const tracking = new EmailTracking({
          emailId: email._id,
          campaignId: followup.campaignId._id,
          contactId: followup.contactId._id,
          trackingPixelId: `track_${email._id}_${Date.now()}`
        })
        await tracking.save()

        logger.info(`Followup sent: ${followup._id}`)
      } catch (error) {
        logger.error(`Error processing followup ${followup._id}:`, error)
        followup.status = "failed"
        await followup.save()
      }
    }
  } catch (error) {
    logger.error("Error processing scheduled followups:", error)
    throw error
  }
}

// Check Followup Conditions
async function checkFollowupConditions(followup) {
  try {
    const originalEmail = await Email.findById(followup.originalEmailId._id)
    if (!originalEmail) return false

    const tracking = await EmailTracking.findOne({ emailId: originalEmail._id })

    if (!tracking) return false

    // Check if email was opened
    if (followup.conditions.requireOpen) {
      const opened = tracking.events.some(event => event.type === "opened")
      if (!opened) return false
    }

    // Check if email was clicked
    if (followup.conditions.requireClick) {
      const clicked = tracking.events.some(event => event.type === "clicked")
      if (!clicked) return false
    }

    // Check if no reply received
    if (followup.conditions.requireNoReply) {
      const replied = tracking.events.some(event => event.type === "replied")
      if (replied) return false
    }

    return true
  } catch (error) {
    logger.error("Error checking followup conditions:", error)
    return false
  }
}

// Analytics and Reporting
async function getCampaignStats(campaignId, userId) {
  try {
    const campaign = await Campaign.findOne({ _id: campaignId, userId })
    if (!campaign) {
      throw new Error("Campaign not found")
    }

    const emails = await Email.find({ campaignId })
    const followups = await Followup.find({ campaignId })
    const tracking = await EmailTracking.find({ campaignId })

    // Calculate detailed stats
    const stats = {
      totalEmails: emails.length,
      totalFollowups: followups.length,
      sentEmails: emails.filter(e => e.status === "sent").length,
      sentFollowups: followups.filter(f => f.status === "sent").length,
      openedEmails: 0,
      clickedEmails: 0,
      repliedEmails: 0,
      bouncedEmails: 0,
      unsubscribed: 0
    }

    // Count tracking events
    for (const track of tracking) {
      for (const event of track.events) {
        switch (event.type) {
          case "opened":
            stats.openedEmails++
            break
          case "clicked":
            stats.clickedEmails++
            break
          case "replied":
            stats.repliedEmails++
            break
          case "bounced":
            stats.bouncedEmails++
            break
          case "unsubscribed":
            stats.unsubscribed++
            break
        }
      }
    }

    return stats
  } catch (error) {
    logger.error("Error getting campaign stats:", error)
    throw error
  }
}

// Manual start function for draft campaigns
async function manualStartCampaign(campaignId, userId) {
  try {
    const campaign = await Campaign.findOne({ _id: campaignId, userId })

    if (!campaign) {
      throw new Error("Campaign not found")
    }

    if (campaign.status !== "draft") {
      logger.info(`Manual start ignored: campaign ${campaignId} already in status ${campaign.status}`)
      return campaign
    }

    logger.info(`Manual start requested for campaign: ${campaignId}`)

    // Handle based on sendType
    if (campaign.sendType === 'immediate') {
      return await startCampaign(campaignId, userId)
    } else if (campaign.sendType === 'scheduled') {
      return await updateCampaignStatus(campaignId, 'scheduled')
    } else if (campaign.sendType === 'sequence') {
      // Completely disable old sequence method to prevent conflicts
      logger.info(`Manual start for sequence campaign ${campaignId} - using new sequence service only`)
      const sequenceService = require('./sequenceService')
      return await sequenceService.createSequenceCampaign(campaignId, userId)
    } else {
      throw new Error("Invalid send type")
    }
  } catch (error) {
    logger.error("Error in manual start:", error)
    throw error
  }
}

// Contact Statistics
async function getContactStats(userId) {
  try {
    const query = { userId }

    // Run multiple counts in parallel for performance
    const [total, active, unsubscribed, bounced, complained, withProducts] = await Promise.all([
      Contact.countDocuments(query),
      Contact.countDocuments({ ...query, status: 'active' }),
      Contact.countDocuments({ ...query, status: 'unsubscribed' }),
      Contact.countDocuments({ ...query, status: 'bounced' }),
      Contact.countDocuments({ ...query, status: 'complained' }),
      Contact.countDocuments({ ...query, interestedProducts: { $exists: true, $not: { $size: 0 } } })
    ])

    return {
      total,
      active,
      unsubscribed,
      bounced,
      complained,
      withProducts
    }
  } catch (error) {
    logger.error("Error fetching contact stats:", error)
    throw error
  }
}

// Dashboard statistics
async function getDashboardStats(userId) {
  try {
    const query = { userId }

    // Execute all counts in parallel
    const [
      totalCampaigns,
      activeCampaigns,
      completedCampaigns,
      totalContacts,
      activeContacts,
      unsubscribedContacts,
      totalTemplates,
      activeTemplates,
      totalLists
    ] = await Promise.all([
      Campaign.countDocuments(query),
      Campaign.countDocuments({ ...query, status: { $in: ['sending', 'scheduled'] } }),
      Campaign.countDocuments({ ...query, status: { $in: ['sent', 'completed'] } }),
      Contact.countDocuments(query),
      Contact.countDocuments({ ...query, status: 'active' }),
      Contact.countDocuments({ ...query, status: 'unsubscribed' }),
      Template.countDocuments(query),
      Template.countDocuments({ ...query, isActive: true }),
      ContactList.countDocuments(query)
    ])

    // Get status breakdown for chart
    const campaignsByStatus = await Campaign.aggregate([
      { $match: query },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ])

    // Get recent growth (last 6 months) for chart
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)

    const contactGrowth = await Contact.aggregate([
      {
        $match: {
          ...query,
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ])

    // Get template usage by type
    const templatesByType = await Template.aggregate([
      { $match: query },
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ])

    return {
      counts: {
        campaigns: { total: totalCampaigns, active: activeCampaigns, completed: completedCampaigns },
        contacts: { total: totalContacts, active: activeContacts, unsubscribed: unsubscribedContacts },
        templates: { total: totalTemplates, active: activeTemplates },
        lists: { total: totalLists }
      },
      charts: {
        campaignsByStatus,
        contactGrowth,
        templatesByType
      }
    }
  } catch (error) {
    logger.error("Error fetching dashboard stats:", error)
    throw error
  }
}

module.exports = {
  // Campaign Management
  createCampaign,
  getCampaigns,
  getAllCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  startCampaign,

  // Contact Management
  createContact,
  getContactStats,
  getContacts,
  getAllContacts,
  updateContact,
  deleteContact,

  // Contact List Management
  createContactList,
  getContactLists,
  getAllContactLists,
  updateContactList,
  deleteContactList,

  // Template Management
  createTemplate,
  getTemplates,
  getAllTemplates,
  updateTemplate,
  deleteTemplate,

  // Follow-up Management
  createFollowup,
  getFollowups,
  updateFollowup,
  deleteFollowup,

  // Campaign Execution
  processScheduledFollowups,
  processScheduledCampaigns,
  processDueEmails,
  sendCampaignEmails,
  updateCampaignStatus,
  setupSequenceFollowups,
  manualStartCampaign,

  // Analytics
  getCampaignStats,
  syncContactListCounts,
  getDashboardStats
}