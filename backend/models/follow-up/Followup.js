const mongoose = require("mongoose")

const followupSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    originalEmailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Email",
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
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    sequence: {
      type: Number,
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    sentAt: Date,
    status: {
      type: String,
      enum: ["scheduled", "sent", "cancelled", "failed"],
      default: "scheduled",
    },
    // Optional per-followup custom message (for explicit sequence steps)
    message: { type: String },
    conditions: {
      requireOpen: { type: Boolean, default: false },
      requireClick: { type: Boolean, default: false },
      requireNoReply: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  },
)

followupSchema.index({ scheduledAt: 1, status: 1 })

module.exports = mongoose.model("Followup", followupSchema)
