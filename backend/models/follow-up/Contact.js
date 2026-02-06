const mongoose = require("mongoose")

const contactSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    firstName: String,
    lastName: String,
    company: String,
    position: String,
    phone: String,
    tags: [String],
    interestedProducts: [String],
    customFields: {
      type: Map,
      of: String,
    },
    status: {
      type: String,
      enum: ["active", "unsubscribed", "bounced", "complained"],
      default: "active",
    },
    listIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ContactList",
      },
    ],
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    lastEngagement: Date,
    engagementScore: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

contactSchema.index({ email: 1, userId: 1 }, { unique: true })

module.exports = mongoose.model("Contact", contactSchema)
