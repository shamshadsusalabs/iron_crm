const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Subdocument schema for storing per-admin email settings
const emailSettingsSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    user: { type: String, trim: true },
    // Encrypted password string (AES-256-GCM). Use utils/crypto to set/get.
    passwordEnc: { type: String },
    imapHost: { type: String, default: 'imap.gmail.com' },
    imapPort: { type: Number, default: 993 },
    smtpHost: { type: String, default: 'smtp.gmail.com' },
    smtpPort: { type: Number, default: 465 },
    fromName: { type: String, trim: true },
    signature: { type: String },
    lastSyncedAt: { type: Date },
  },
  { _id: false, timestamps: false }
);

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true, // Indexed for faster lookups
    },
    role: { type: String, default: 'admin', enum: ['admin'] },
    password: { type: String, required: true },
    lastLogin: { type: Date },
    emailSettings: { type: emailSettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Password hashing middleware
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare password
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
