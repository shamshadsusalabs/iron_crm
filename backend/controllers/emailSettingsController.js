const Admin = require('../models/admin')
const User = require('../models/user')
const { encrypt } = require('../utils/crypto')
const emailService = require('../services/emailService')

// Normalize settings payload
function buildSettingsFromBody(body) {
  const {
    user,
    password, // plain text from form
    fromName,
    enabled,
    imapHost,
    imapPort,
    smtpHost,
    smtpPort,
  } = body || {}

  const settings = {
    enabled: enabled !== undefined ? !!enabled : true,
    user: user?.trim(),
    fromName: fromName?.trim(),
  }
  if (imapHost) settings.imapHost = imapHost
  if (imapPort) settings.imapPort = Number(imapPort)
  if (smtpHost) settings.smtpHost = smtpHost
  if (smtpPort) settings.smtpPort = Number(smtpPort)
  if (password) settings.passwordEnc = encrypt(password)
  return settings
}

function sanitize(settings) {
  if (!settings) return null
  const { passwordEnc, ...rest } = settings.toObject ? settings.toObject() : settings
  return rest
}

// GET current admin settings
exports.getAdminSettings = async (req, res) => {
  try {
    const admin = await Admin.findById(req.userId).select('emailSettings email name')
    return res.json({ success: true, data: sanitize(admin?.emailSettings) })
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message })
  }
}

// PUT update admin settings
exports.updateAdminSettings = async (req, res) => {
  try {
    const settings = buildSettingsFromBody(req.body)
    const admin = await Admin.findByIdAndUpdate(
      req.userId,
      { $set: { emailSettings: settings } },
      { new: true, upsert: false }
    ).select('emailSettings')
    return res.json({ success: true, data: sanitize(admin.emailSettings) })
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message })
  }
}

// POST test admin settings (without saving necessarily)
exports.testAdminSettings = async (req, res) => {
  try {
    const body = req.body || {}
    const cfg = {
      user: body.user,
      password: body.password,
      imapHost: body.imapHost,
      imapPort: body.imapPort,
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort,
      fromName: body.fromName,
    }
    // Try SMTP verify via nodemailer transporter
    try {
      // send a verify by constructing transporter through emailService internal helper
      // We simulate by sending a zero-sized verify using nodemailer via sendEmail with no to -> instead use transporter.verify
      const effective = {
        user: cfg.user,
        password: cfg.password,
        imapHost: cfg.imapHost,
        imapPort: cfg.imapPort,
        smtpHost: cfg.smtpHost,
        smtpPort: cfg.smtpPort,
        fromName: cfg.fromName,
      }
      // construct transporter
      const nodemailer = require('nodemailer')
      const tx = nodemailer.createTransport({
        host: effective.smtpHost || 'smtp.gmail.com',
        port: effective.smtpPort || 465,
        secure: (effective.smtpPort || 465) === 465,
        auth: { user: effective.user, pass: effective.password },
        tls: { rejectUnauthorized: false },
      })
      await tx.verify()
    } catch (err) {
      return res.status(400).json({ success: false, message: 'SMTP verification failed', error: err.message })
    }
    return res.json({ success: true, message: 'SMTP verified' })
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message })
  }
}

// GET merch settings
exports.getMerchSettings = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('emailSettings email name')
    return res.json({ success: true, data: sanitize(user?.emailSettings) })
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message })
  }
}

// PUT update merch settings
exports.updateMerchSettings = async (req, res) => {
  try {
    const settings = buildSettingsFromBody(req.body)
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { emailSettings: settings } },
      { new: true, upsert: false }
    ).select('emailSettings')
    return res.json({ success: true, data: sanitize(user.emailSettings) })
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message })
  }
}

// POST test merch settings
exports.testMerchSettings = async (req, res) => {
  try {
    const body = req.body || {}
    const effective = {
      user: body.user,
      password: body.password,
      imapHost: body.imapHost,
      imapPort: body.imapPort,
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort,
      fromName: body.fromName,
    }
    try {
      const nodemailer = require('nodemailer')
      const tx = nodemailer.createTransport({
        host: effective.smtpHost || 'smtp.gmail.com',
        port: effective.smtpPort || 465,
        secure: (effective.smtpPort || 465) === 465,
        auth: { user: effective.user, pass: effective.password },
        tls: { rejectUnauthorized: false },
      })
      await tx.verify()
    } catch (err) {
      return res.status(400).json({ success: false, message: 'SMTP verification failed', error: err.message })
    }
    return res.json({ success: true, message: 'SMTP verified' })
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message })
  }
}
