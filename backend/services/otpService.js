const nodemailer = require('nodemailer');
const TrustedDevice = require('../models/TrustedDevice');

// In-memory OTP storage (in production, use Redis)
// Structure: { email: { otp: string, expiresAt: Date, userId: ObjectId, attempts: number } }
const otpStore = new Map();

// Configuration
const OTP_EXPIRY_MINUTES = 15;
const MAX_ATTEMPTS = 3;

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Store OTP for a user
const storeOTP = (email, userId) => {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt,
    userId,
    attempts: 0,
  });

  console.log(`[OTP] Generated for ${email}: ${otp} (expires at ${expiresAt})`);
  return otp;
};

// Send OTP to receiver email (RECVED_MAIL)
const sendOTPToAdmin = async (merchEmail, merchName, otp) => {
  const transporter = createTransporter();
  const senderEmail = process.env.EMAIL_USER;
  const receiverEmail = process.env.RECVED_MAIL || process.env.EMAIL_USER; // fallback to sender if RECVED_MAIL not set

  console.log(`[OTP] ========== EMAIL CONFIG ==========`);
  console.log(`[OTP] SMTP User (EMAIL_USER): ${senderEmail}`);
  console.log(`[OTP] SMTP Pass (EMAIL_PASS): ${process.env.EMAIL_PASS ? '****' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET'}`);
  console.log(`[OTP] FROM (sender): ${senderEmail}`);
  console.log(`[OTP] TO (receiver / RECVED_MAIL): ${receiverEmail}`);
  console.log(`[OTP] Merchandiser trying to login: ${merchName || 'N/A'} (${merchEmail})`);
  console.log(`[OTP] OTP Code: ${otp}`);
  console.log(`[OTP] ====================================`);

  const mailOptions = {
    from: `CRM System <${senderEmail}>`,
    to: receiverEmail,
    subject: `🔐 Merchandiser Login OTP - ${merchName || merchEmail}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">🔐 Login Verification</h1>
        </div>
        <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            A merchandiser is trying to login to the CRM system:
          </p>
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin-bottom: 20px;">
            <p style="margin: 0 0 10px 0;"><strong>Name:</strong> ${merchName || 'N/A'}</p>
            <p style="margin: 0;"><strong>Email:</strong> ${merchEmail}</p>
          </div>
          <p style="font-size: 16px; color: #333; margin-bottom: 10px;">
            Their One-Time Password (OTP) is:
          </p>
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <span style="font-size: 36px; font-weight: bold; color: white; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #666; margin-bottom: 10px;">
            ⏱️ This OTP will expire in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
          </p>
          <p style="font-size: 14px; color: #666;">
            If you did not authorize this login, please ignore this email and review user access.
          </p>
          <hr style="border: none; border-top: 1px solid #e9ecef; margin: 20px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">
            This is an automated message from your CRM System.
          </p>
        </div>
      </div>
    `,
    text: `Merchandiser Login OTP\n\nName: ${merchName || 'N/A'}\nEmail: ${merchEmail}\n\nOTP: ${otp}\n\nThis OTP will expire in ${OTP_EXPIRY_MINUTES} minutes.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[OTP] Email sent to admin for ${merchEmail}`);
    return true;
  } catch (error) {
    console.error('[OTP] Failed to send email:', error.message);
    throw new Error('Failed to send OTP email');
  }
};

// Verify OTP
const verifyOTP = (email, inputOTP) => {
  // DEBUG: Master OTP bypass
  /*
  if (inputOTP === '123456') {
    // If user enters master code, find userId from store (if exists) or we need another way to get userId.
    // However, verifyOTP is called AFTER requestOTP where we stored the OTP.
    // So the email should be in the store.
    const stored = otpStore.get(email.toLowerCase());
    if (stored) {
      const userId = stored.userId;
      otpStore.delete(email.toLowerCase());
      return { valid: true, userId };
    }
    // If not in store (e.g. server restarted or expired), we can't get userId easily unless we query DB again.
    // But verifyOTP function doesn't seem to be async or have DB access here.
    // Let's rely on the fact that requestOTP was called first.
    return { valid: false, message: 'OTP session expired. Please request OTP again.' };
  }
  */

  const normalizedEmail = email.toLowerCase();



  const stored = otpStore.get(normalizedEmail);

  if (!stored) {
    return { valid: false, message: 'OTP not found. Please request a new one.' };
  }

  // Check expiry
  if (new Date() > stored.expiresAt) {
    otpStore.delete(normalizedEmail);
    return { valid: false, message: 'OTP has expired. Please request a new one.' };
  }

  // Check attempts
  if (stored.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(normalizedEmail);
    return { valid: false, message: 'Too many invalid attempts. Please request a new OTP.' };
  }

  // Verify OTP
  if (stored.otp !== inputOTP) {
    stored.attempts += 1;
    return {
      valid: false,
      message: `Invalid OTP. ${MAX_ATTEMPTS - stored.attempts} attempts remaining.`
    };
  }

  // OTP is valid - remove from store
  const userId = stored.userId;
  otpStore.delete(normalizedEmail);

  return { valid: true, userId };
};

// Check if OTP exists and is pending
const hasPendingOTP = (email) => {
  const stored = otpStore.get(email.toLowerCase());
  if (!stored) return false;
  if (new Date() > stored.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return false;
  }
  return true;
};

// Get remaining time for OTP
const getOTPRemainingTime = (email) => {
  const stored = otpStore.get(email.toLowerCase());
  if (!stored) return 0;
  const remaining = Math.max(0, (stored.expiresAt - new Date()) / 1000);
  return Math.ceil(remaining);
};

// ===================== TRUSTED DEVICE FUNCTIONS =====================

const TRUST_DURATION_DAYS = 30;

/**
 * Check if a device is trusted for a given user
 * @param {string} userId - User's MongoDB ObjectId
 * @param {string} fingerprint - Hashed browser fingerprint
 * @returns {Promise<boolean>} - true if device is trusted and not expired
 */
const isDeviceTrusted = async (userId, fingerprint) => {
  try {
    const device = await TrustedDevice.findOne({
      userId,
      fingerprint,
      expiresAt: { $gt: new Date() },
    });

    if (device) {
      // Update lastUsedAt
      device.lastUsedAt = new Date();
      await device.save();
      console.log(`[TrustedDevice] Device trusted for user ${userId}`);
      return true;
    }

    console.log(`[TrustedDevice] Device NOT trusted for user ${userId}`);
    return false;
  } catch (error) {
    console.error('[TrustedDevice] Error checking trust:', error.message);
    return false;
  }
};

/**
 * Save a device as trusted for TRUST_DURATION_DAYS days
 * @param {string} userId - User's MongoDB ObjectId
 * @param {string} fingerprint - Hashed browser fingerprint
 * @param {string} deviceInfo - Human-readable device description (browser/OS)
 * @returns {Promise<Object>} - The saved TrustedDevice document
 */
const trustDevice = async (userId, fingerprint, deviceInfo = 'Unknown Device') => {
  try {
    const expiresAt = new Date(Date.now() + TRUST_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const device = await TrustedDevice.findOneAndUpdate(
      { userId, fingerprint },
      {
        userId,
        fingerprint,
        deviceInfo,
        trustedAt: new Date(),
        expiresAt,
        lastUsedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log(`[TrustedDevice] Device trusted for user ${userId}, expires: ${expiresAt}`);
    return device;
  } catch (error) {
    console.error('[TrustedDevice] Error saving trust:', error.message);
    throw error;
  }
};

/**
 * Remove a trusted device
 * @param {string} userId - User's MongoDB ObjectId
 * @param {string} fingerprint - Hashed browser fingerprint
 * @returns {Promise<boolean>} - true if device was removed
 */
const removeDeviceTrust = async (userId, fingerprint) => {
  try {
    const result = await TrustedDevice.deleteOne({ userId, fingerprint });
    console.log(`[TrustedDevice] Removed trust for user ${userId}: ${result.deletedCount > 0}`);
    return result.deletedCount > 0;
  } catch (error) {
    console.error('[TrustedDevice] Error removing trust:', error.message);
    return false;
  }
};

module.exports = {
  generateOTP,
  storeOTP,
  sendOTPToAdmin,
  verifyOTP,
  hasPendingOTP,
  getOTPRemainingTime,
  OTP_EXPIRY_MINUTES,
  // Trusted device functions
  isDeviceTrusted,
  trustDevice,
  removeDeviceTrust,
  TRUST_DURATION_DAYS,
};
