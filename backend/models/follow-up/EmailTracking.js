const mongoose = require("mongoose")

const emailTrackingSchema = new mongoose.Schema(
  {
    emailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Email",
      required: true,
    },
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
    trackingPixelId: {
      type: String,
      required: true,
      unique: true,
    },
    events: [
      {
        type: {
          type: String,
          enum: ["sent", "delivered", "opened", "clicked", "bounced", "unsubscribed"],
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        data: {
          type: Map,
          of: String,
        },
      },
    ],
    ipAddress: String,
    userAgent: String,
    location: {
      country: String,
      city: String,
      region: String,
    },
  },
  {
    timestamps: true,
  },
)

emailTrackingSchema.index({ trackingPixelId: 1 })
emailTrackingSchema.index({ emailId: 1 })

module.exports = mongoose.model("EmailTracking", emailTrackingSchema)
