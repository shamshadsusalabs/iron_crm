const mongoose = require("mongoose")

const unsubscribeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
    },
    reason: String,
    ipAddress: String,
    userAgent: String,
    unsubscribeToken: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  },
)

unsubscribeSchema.index({ email: 1 })
unsubscribeSchema.index({ unsubscribeToken: 1 })

module.exports = mongoose.model("Unsubscribe", unsubscribeSchema)
