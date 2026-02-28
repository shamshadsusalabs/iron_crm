const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const User = require('../models/user')
const { generateAccessToken, generateRefreshToken } = require('../utils/generateTokens')
const otpService = require('../services/otpService')

// Step 1: Request OTP (validates credentials first, then sends OTP to admin)
// If deviceFingerprint is present and trusted, skip OTP entirely
exports.requestOTP = async (req, res) => {
  try {
    const { email, password, deviceFingerprint, deviceInfo } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const lookupEmail = String(email).toLowerCase()
    console.log('[merch.requestOTP] Attempt with email:', lookupEmail)

    const user = await User.findOne({ email: lookupEmail })
    if (!user) {
      console.log('[merch.requestOTP] User not found for email:', lookupEmail)
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const rawPwd = String(password)
    let ok = await bcrypt.compare(rawPwd, user.password)
    if (!ok && rawPwd.trim() !== rawPwd) {
      ok = await bcrypt.compare(rawPwd.trim(), user.password)
    }
    console.log('[merch.requestOTP] Password compare:', ok, 'userId:', user._id.toString())
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' })

    // Block inactive users
    if (!user.active) {
      console.log('[merch.requestOTP] Inactive account for userId:', user._id.toString())
      return res.status(403).json({ message: 'Account inactive. Please contact admin.' })
    }

    // ===== TRUSTED DEVICE CHECK =====
    if (deviceFingerprint) {
      const isTrusted = await otpService.isDeviceTrusted(user._id, deviceFingerprint)
      if (isTrusted) {
        console.log('[merch.requestOTP] Trusted device detected, skipping OTP for:', lookupEmail)

        // Update lastLogin
        user.lastLogin = new Date()
        await user.save()

        // Issue tokens directly
        const role = 'merch'
        const accessToken = generateAccessToken(user._id, role)
        const refreshToken = generateRefreshToken(user._id, role)

        res.cookie('merchRefreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        const safe = user.toObject()
        delete safe.password

        return res.status(200).json({
          otpRequired: false,
          message: 'Trusted device — logged in directly',
          accessToken,
          refreshToken,
          user: safe,
        })
      }
    }
    // ===== END TRUSTED DEVICE CHECK =====

    // Generate and store OTP
    const otp = otpService.storeOTP(lookupEmail, user._id)

    // Send OTP to admin email
    await otpService.sendOTPToAdmin(lookupEmail, user.name, otp)

    console.log('[merch.requestOTP] OTP sent to admin for:', lookupEmail)

    return res.status(200).json({
      otpRequired: true,
      message: 'OTP sent to admin for verification',
      expiresIn: otpService.OTP_EXPIRY_MINUTES * 60, // seconds
      email: lookupEmail,
    })
  } catch (err) {
    console.log('[merch.requestOTP] Error:', err?.message)
    return res.status(500).json({ message: 'Failed to send OTP', error: err.message })
  }
}

// Step 2: Verify OTP and complete login
// If trustDevice flag is set, save device as trusted
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp, trustDevice: shouldTrustDevice, deviceFingerprint, deviceInfo } = req.body
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' })
    }

    const lookupEmail = String(email).toLowerCase()
    console.log('[merch.verifyOTP] Verifying OTP for:', lookupEmail)

    // Verify OTP
    const result = otpService.verifyOTP(lookupEmail, otp)
    if (!result.valid) {
      console.log('[merch.verifyOTP] Invalid OTP:', result.message)
      return res.status(401).json({ message: result.message })
    }

    // OTP valid - get user and issue tokens
    const user = await User.findById(result.userId)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Update lastLogin
    user.lastLogin = new Date()
    await user.save()

    // Issue tokens
    const role = 'merch'
    const accessToken = generateAccessToken(user._id, role)
    const refreshToken = generateRefreshToken(user._id, role)
    console.log('[merch.verifyOTP] Login successful for userId:', user._id.toString())

    // ===== SAVE TRUSTED DEVICE =====
    if (shouldTrustDevice && deviceFingerprint) {
      try {
        await otpService.trustDevice(user._id, deviceFingerprint, deviceInfo || 'Unknown Device')
        console.log('[merch.verifyOTP] Device trusted for userId:', user._id.toString())
      } catch (trustErr) {
        // Don't fail login if trust save fails
        console.error('[merch.verifyOTP] Failed to trust device:', trustErr.message)
      }
    }
    // ===== END SAVE TRUSTED DEVICE =====

    res.cookie('merchRefreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    const safe = user.toObject()
    delete safe.password

    return res.status(200).json({ accessToken, refreshToken, user: safe })
  } catch (err) {
    console.log('[merch.verifyOTP] Error:', err?.message)
    return res.status(500).json({ message: 'OTP verification failed', error: err.message })
  }
}

// Legacy login endpoint (kept for backward compatibility, but redirects to OTP flow)
exports.login = async (req, res) => {
  // For backward compatibility, this now just calls requestOTP
  return exports.requestOTP(req, res)
}

// Refresh token
exports.refreshToken = async (req, res) => {
  try {
    const cookieToken = req.cookies?.merchRefreshToken
    const headerToken = req.headers['x-refresh-token']
    const bodyToken = req.body?.token
    console.log('[merch.refresh] sources:', { hasCookie: !!cookieToken, hasHeader: !!headerToken, hasBody: !!bodyToken })
    const token = cookieToken || headerToken || bodyToken
    if (!token) return res.status(401).json({ message: 'Refresh token required' })

    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET)
    console.log('[merch.refresh] Decoded:', { userId: decoded?.userId, role: decoded?.role })
    const accessToken = generateAccessToken(decoded.userId, decoded.role || 'merch')
    return res.status(200).json({ accessToken })
  } catch (err) {
    console.log('[merch.refresh] Verify error:', err?.name, err?.message)
    return res.status(403).json({ message: 'Invalid or expired refresh token' })
  }
}

// Get profile (requires merch auth)
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password').lean()
    if (!user) return res.status(404).json({ message: 'User not found' })
    return res.status(200).json(user)
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load profile', error: err.message })
  }
}

// Logout
exports.logout = async (req, res) => {
  try {
    res.clearCookie('merchRefreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    })
    return res.status(200).json({ message: 'Logged out' })
  } catch (err) {
    return res.status(500).json({ message: 'Logout failed' })
  }
}
