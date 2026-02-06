const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,
  imapHost: 'imap.gmail.com',
  imapPort: 993,
  smtpHost: 'smtp.gmail.com',
  smtpPort: 465 // SSL
};

