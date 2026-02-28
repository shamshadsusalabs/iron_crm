const jwt = require('jsonwebtoken');

exports.generateAccessToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '12h', // 12 hour session for merchandiser
  });
};

exports.generateRefreshToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '7d', // Long-lived token
  });
};
