const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');

exports.verifyAccessToken = async (req, res, next) => {
  const token =
    req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : req.body?.accessToken ||
        req.query?.accessToken ||
        req.headers['x-access-token'];

  if (!token) {
    return res.status(401).json({ message: 'Access token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    if (!decoded.userId || decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admins only' });
    }

    // ✅ Check if admin exists
    const admin = await Admin.findById(decoded.userId).select('_id');
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    req.userId = decoded.userId;
    req.role = decoded.role;
    // Attach admin for downstream usage
    req.admin = admin;
    next();
  } catch (err) {
    // Return 401 so clients can refresh access token automatically
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
