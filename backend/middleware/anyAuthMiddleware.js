const jwt = require('jsonwebtoken')
const Admin = require('../models/admin')
const User = require('../models/user')

// Accepts either admin or merch JWT and sets req.userId + req.role
module.exports = async function anyAuth(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : req.body?.accessToken || req.query?.accessToken || req.headers['x-access-token']

  if (!token) return res.status(401).json({ message: 'Access token missing' })
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    const { userId, role } = decoded || {}
    if (!userId || !role) return res.status(401).json({ message: 'Invalid token payload' })

    if (role === 'admin') {
      const admin = await Admin.findById(userId).select('_id')
      if (!admin) return res.status(404).json({ message: 'Admin not found' })
      req.userId = userId
      req.role = 'admin'
      req.admin = admin
      return next()
    }

    if (role === 'merch' || role === 'Merchandiser') {
      const user = await User.findById(userId).select('_id active')
      if (!user) return res.status(404).json({ message: 'User not found' })
      if (user.active === false) return res.status(403).json({ message: 'User inactive' })
      req.userId = userId
      req.role = 'merch'
      req.user = user
      return next()
    }

    return res.status(403).json({ message: 'Unauthorized role' })
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}
