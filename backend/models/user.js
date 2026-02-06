const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Subdocument for per-user (Merchandiser) email settings
const emailSettingsSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    user: { type: String, trim: true },
    // Encrypted password (AES-256-GCM). Use utils/crypto to set/get.
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

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    role: { type: String, required: true, enum: ['Merchandiser'], default: 'Merchandiser' },
    avatar: { type: String },
    password: { type: String, required: true, minlength: 6 },
    // Granular permissions for Merchandiser UI
    isLeadAccess: { type: Boolean, default: false },
    isCustomerProfiling: { type: Boolean, default: false },
    isCustomerEnquiry: { type: Boolean, default: false },
    isEmailAccess: { type: Boolean, default: false },
    isFollowUpAccess: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    lastLogin: { type: Date },
    emailSettings: { type: emailSettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Hash password before save if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
