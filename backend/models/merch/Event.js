const mongoose = require('mongoose')

const AttachmentSchema = new mongoose.Schema(
  {
    file: { type: String, required: true },
  },
  { _id: false }
)

const MerchEventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['one-time', 'recurring'], default: 'one-time' },
    startAt: { type: Date, required: true },

    // Recurrence
    recurrence: { type: String, enum: ['daily', 'weekly', 'monthly', 'custom', null], default: null },
    interval: { type: Number, min: 1, default: null }, // used when recurrence === 'custom'
    endDate: { type: Date, default: null },

    audience: [{ type: String }], // e.g., ['hot','cold','followup']
    template: { type: String, default: '' },
    attachments: { type: [AttachmentSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('MerchEvent', MerchEventSchema)
