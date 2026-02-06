const nodemailer = require('nodemailer');

// In-memory OTP storage (in production, use Redis)
// Structure: { email: { otp: string, expiresAt: Date, userId: ObjectId, attempts: number } }
const otpStore = new Map();

// Configuration
const OTP_EXPIRY_MINUTES = 5;
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

// Send OTP to admin email
const sendOTPToAdmin = async (merchEmail, merchName, otp) => {
    const transporter = createTransporter();
    const adminEmail = process.env.EMAIL_USER;

    const mailOptions = {
        from: `CRM System <${adminEmail}>`,
        to: adminEmail,
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

module.exports = {
    generateOTP,
    storeOTP,
    sendOTPToAdmin,
    verifyOTP,
    hasPendingOTP,
    getOTPRemainingTime,
    OTP_EXPIRY_MINUTES,
};
