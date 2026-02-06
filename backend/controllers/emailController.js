// controllers/emailController.js
const emailService = require("../services/emailService")
const emailEvents = require("../services/emailEvents")
const Admin = require("../models/admin")
const User = require("../models/user")
const { decrypt } = require("../utils/crypto")
const envEmail = require("../config/emailConfig")

// Build effective email config using per-user settings if available; otherwise fallback to env
async function resolveEmailConfig(req) {
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

  // If request is authenticated and we have a userId, try to load per-user settings
  const id = req.userId
  if (id) {
    // Try Admin first
    let doc = await Admin.findById(id).select('emailSettings')
    if (!doc) {
      // Then try Merch/User
      doc = await User.findById(id).select('emailSettings')
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
  }

  // Fallback to env-based config
  return base
}

function sortThreadsAndEmails(threads) {
  return threads.map((thread) => ({
    ...thread,
    emails: thread.emails.slice().sort((a, b) => {
      const dateA = new Date(a.headers.date[0])
      const dateB = new Date(b.headers.date[0])
      return dateB - dateA // Latest first
    }),
  }))
}

async function spamMails(req, res) {
  try {
    const { page = 1, limit = 10, search = "" } = req.query
    const cfg = await resolveEmailConfig(req)
    const threads = await emailService.fetchSpamMails({
      page: parseInt(page),
      limit: parseInt(limit),
      search: search.toString(),
    }, cfg)
    const sortedThreads = sortThreadsAndEmails(threads)
    res.json({
      success: true,
      data: sortedThreads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: sortedThreads.length,
      },
    })
  } catch (error) {
    console.error("Error fetching spam mails:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch spam emails",
      error: error.message,
    })
  }
}

async function allMails(req, res) {
  try {
    const { page = 1, limit = 10, search = "" } = req.query
    const cfg = await resolveEmailConfig(req)
    const threads = await emailService.fetchAllMails({
      page: parseInt(page),
      limit: parseInt(limit),
      search: search.toString(),
    }, cfg)
    const sortedThreads = sortThreadsAndEmails(threads)
    res.json({
      success: true,
      data: sortedThreads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: sortedThreads.length,
      },
    })
  } catch (error) {
    console.error("Error fetching all mails:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch emails",
      error: error.message,
    })
  }
}

async function sentMails(req, res) {
  try {
    const { page = 1, limit = 10, search = "" } = req.query
    const cfg = await resolveEmailConfig(req)
    const threads = await emailService.fetchSentMails({
      page: parseInt(page),
      limit: parseInt(limit),
      search: search.toString(),
    }, cfg)
    const sortedThreads = sortThreadsAndEmails(threads)
    res.json({
      success: true,
      data: sortedThreads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: sortedThreads.length,
      },
    })
  } catch (error) {
    console.error("Error fetching sent mails:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch sent emails",
      error: error.message,
    })
  }
}

async function receivedMails(req, res) {
  try {
    const { page = 1, limit = 10, search = "" } = req.query
    const cfg = await resolveEmailConfig(req)
    // Debug: which user is fetching and which email account is used
    console.log('Emails.received requested', {
      userId: req.userId,
      role: req.role,
      emailUser: cfg.user,
      imapHost: cfg.imapHost,
      imapPort: cfg.imapPort,
    })
    const threads = await emailService.fetchReceivedMails({
      page: parseInt(page),
      limit: parseInt(limit),
      search: search.toString(),
    }, cfg)
    const sortedThreads = sortThreadsAndEmails(threads)
    res.json({
      success: true,
      data: sortedThreads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: sortedThreads.length,
      },
    })
  } catch (error) {
    console.error("Error fetching received mails:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch received emails",
      error: error.message,
    })
  }
}

async function sendEmail(req, res) {
  try {
    // Handle both JSON and FormData
    let emailData;
    
    if (req.files && req.files.length > 0) {
      // FormData request with attachments
      emailData = {
        to: req.body.to,
        cc: req.body.cc || "",
        bcc: req.body.bcc || "",
        subject: req.body.subject,
        text: req.body.text,
        html: req.body.html,
        attachments: req.files.map(file => ({
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype,
        })),
      };
    } else {
      // JSON request or FormData without attachments
      emailData = {
        to: req.body.to,
        cc: req.body.cc || "",
        bcc: req.body.bcc || "",
        subject: req.body.subject,
        text: req.body.text,
        html: req.body.html,
        attachments: [],
      };
    }

    // Validate required fields
    if (!emailData.to || !emailData.subject) {
      return res.status(400).json({
        success: false,
        message: "To and subject are required fields",
      });
    }

    const cfg = await resolveEmailConfig(req)
    const result = await emailService.sendEmail(emailData, cfg);

    res.json({
      success: true,
      message: "Email sent successfully",
      data: {
        messageId: result.messageId,
        response: result.response,
      },
    });

    // Notify clients to refresh Sent mailbox
    try {
      emailEvents.broadcast('email_new', { mailbox: 'sent' })
    } catch (_) {}
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email",
      error: error.message,
    });
  }
}

async function replyToEmail(req, res) {
  try {
    // Handle both JSON and FormData
    let replyData;
    
    if (req.files && req.files.length > 0) {
      // FormData request with attachments
      replyData = {
        to: req.body.to,
        cc: req.body.cc || "",
        bcc: req.body.bcc || "",
        subject: req.body.subject,
        text: req.body.text,
        html: req.body.html,
        messageId: req.body.messageId,
        references: req.body.references || "",
        attachments: req.files.map(file => ({
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype,
        })),
      };
    } else {
      // JSON request or FormData without attachments
      replyData = {
        to: req.body.to,
        cc: req.body.cc || "",
        bcc: req.body.bcc || "",
        subject: req.body.subject,
        text: req.body.text,
        html: req.body.html,
        messageId: req.body.messageId,
        references: req.body.references || "",
        attachments: [],
      };
    }

    // Validate required fields
    if (!replyData.to || !replyData.subject || !replyData.messageId) {
      return res.status(400).json({
        success: false,
        message: "To, subject, and messageId are required fields",
      });
    }

    const cfg = await resolveEmailConfig(req)
    const result = await emailService.replyToEmail(replyData, cfg);

    res.json({
      success: true,
      message: "Reply sent successfully",
      data: {
        messageId: result.messageId,
        response: result.response,
      },
    });

    // Notify clients to refresh Sent mailbox
    try {
      emailEvents.broadcast('email_new', { mailbox: 'sent' })
    } catch (_) {}
  } catch (error) {
    console.error("Error sending reply:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send reply",
      error: error.message,
    });
  }
}

module.exports = {
  allMails,
  sentMails,
  receivedMails,
  spamMails,
  sendEmail,
  replyToEmail,
}