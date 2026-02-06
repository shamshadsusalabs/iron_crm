const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema(
  {
    date: { type: Date },
    action: { type: String, trim: true },
    details: { type: String, trim: true },
  },
  { _id: false }
);

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    status: { type: String, enum: ['Hot', 'Warm', 'Cold'], default: 'Warm', index: true },
    interestedProducts: [{ type: String, trim: true }],
    history: [HistorySchema],
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'createdByModel' },
    createdByModel: { type: String, required: true, enum: ['User', 'Admin'] },
  },
  { timestamps: true }
);

CustomerSchema.index({ name: 'text', email: 'text', address: 'text' });

module.exports = mongoose.model('Customer', CustomerSchema);
