const mongoose = require('mongoose')

const LeadSchema = new mongoose.Schema(
  {
    customer: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    status: { type: String, enum: ['Hot', 'Cold', 'Follow-up'], default: 'Follow-up', index: true },
    priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium', index: true },
    lastContact: { type: Date, default: null, index: true },
    nextAction: { type: Date, default: null },
    notes: { type: String, default: '' },
    interestedProducts: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Merch', required: true, index: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('MerchLead', LeadSchema)
