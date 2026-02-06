const mongoose = require("mongoose")

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: false,
    },
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      required: false, // Optional for catalog-based campaigns
    },
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Contact",
      },
    ],
    contactLists: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ContactList",
      },
    ],
    status: {
      type: String,
      enum: ["draft", "scheduled", "sending", "sent", "paused", "completed"],
      default: "draft",
    },
    sendType: {
      type: String,
      enum: ["immediate", "scheduled", "sequence"],
      default: "immediate",
    },
    scheduledAt: Date,
    sentAt: Date,
    sequence: {
      initialDelay: { type: Number, default: 0 }, // hours
      followupDelays: [{ type: Number }], // hours between followups
      maxFollowups: { type: Number, default: 3 },
      repeatDays: { type: Number, default: 0 }, // Global repeat setting (0 = no repeat)
      conditions: {
        openEmail: { type: Boolean, default: false },
        clickLink: { type: Boolean, default: false },
        replyEmail: { type: Boolean, default: false },
      },
      // Optional explicit per-step configuration and template selection
      steps: [
        {
          delayHours: { type: Number },
          templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
          contentType: { 
            type: String, 
            enum: ["template", "catalog"], 
            default: "template" 
          },
          // For catalog-based steps
          catalogItems: [{ 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "CatalogItem" 
          }],
          subject: { type: String }, // Required for catalog steps
          conditions: {
            requireOpen: { type: Boolean },
            requireClick: { type: Boolean },
            requireNoReply: { type: Boolean },
          },
          // Optional per-step custom message to append with template when sending
          message: { type: String },
        },
      ],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    settings: {
      trackOpens: { type: Boolean, default: true },
      trackClicks: { type: Boolean, default: true },
      enableFollowups: { type: Boolean, default: true },
      followupDelay: { type: Number, default: 3 }, // days
      maxFollowups: { type: Number, default: 3 },
    },
    stats: {
      totalSent: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      bounced: { type: Number, default: 0 },
      unsubscribed: { type: Number, default: 0 },
    },
    processingLock: { type: Date },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("Campaign", campaignSchema)
