const jwt = require('jsonwebtoken')
const User = require('../models/user')

exports.verifyMerchAccessToken = async (req, res, next) => {
  const token =
    req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : req.body?.accessToken || req.query?.accessToken || req.headers['x-access-token']

  if (!token) {
    return res.status(401).json({ message: 'Access token missing' })
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

    // Accept only merch tokens
    if (!decoded.userId || (decoded.role !== 'merch' && decoded.role !== 'Merchandiser')) {
      return res.status(403).json({ message: 'Unauthorized: Merchandiser only' })
    }

    const user = await User.findById(decoded.userId).select('_id active')
    if (!user) return res.status(404).json({ message: 'User not found' })

    req.userId = decoded.userId
    req.role = decoded.role
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}
