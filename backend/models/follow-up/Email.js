const mongoose = require("mongoose")

const emailSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      required: false, // Optional for catalog-based emails
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    messageId: String,
    subject: String,
    htmlContent: String,
    textContent: String,
    // Optional per-email custom message (used for sequence step messages)
    customMessage: String,
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "delivered", "bounced", "failed"],
      default: "queued",
    },
    // When the email should be sent (used for sequence/scheduling)
    scheduledAt: Date,
    sentAt: Date,
    deliveredAt: Date,
    // Repeat functionality
    isRepeat: { type: Boolean, default: false },
    repeatNumber: { type: Number, default: 0 },
    // Store step conditions for repeat logic
    stepConditions: {
      requireOpen: { type: Boolean, default: false },
      requireClick: { type: Boolean, default: false },
      requireNoReply: { type: Boolean, default: false },
    },
    // Processing lock to prevent concurrent processing
    processingLock: { type: Date },
    openedAt: Date,
    clickedAt: Date,
    repliedAt: Date,
    bounceReason: String,
    trackingPixelId: String,
    isFollowup: {
      type: Boolean,
      default: false,
    },
    followupNumber: {
      type: Number,
      default: 0,
    },
    followupSequence: {
      type: Number,
      default: 0,
    },
    parentEmailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Email",
    },
  },
  {
    timestamps: true,
  },
)

emailSchema.index({ campaignId: 1, contactId: 1 })
emailSchema.index({ trackingPixelId: 1 })
// For efficient due-email scans: find queued emails by time
emailSchema.index({ status: 1, scheduledAt: 1 })
// Enhanced indexes for duplicate prevention
emailSchema.index({ campaignId: 1, contactId: 1, followupSequence: 1 }, { unique: true })
emailSchema.index({ campaignId: 1, contactId: 1, followupNumber: 1 })

module.exports = mongoose.model("Email", emailSchema)
